import { clientApi } from "./client-api";

export async function uploadReviewFile(
  file: File,
  field: "zip" | "media" | "avatar",
  admin: boolean,
  context: Record<string, string> = {},
) {
  const path = admin
    ? "/api/admin/reviews/upload-url"
    : "/api/store-proxy/api/reviews/upload-url";
  const values = {
    ...context,
    filename: file.name,
    contentType: file.type || (field === "zip" ? "application/zip" : ""),
    size: file.size,
    field,
  };
  let ticket: { url: string; token: string; contentType: string };
  if (admin)
    ticket = await clientApi(
      path,
      { method: "POST", body: JSON.stringify(values) },
      true,
    );
  else {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.message || result.error || "Unable to prepare review upload.",
      );
    ticket = result;
  }
  let uploaded: Response | undefined;
  try {
    uploaded = await fetch(ticket.url, {
      method: "PUT",
      headers: { "content-type": ticket.contentType },
      body: file,
    });
  } catch {
    /* Fall back to small, same-origin requests when direct storage is blocked. */
  }
  if (!uploaded?.ok) {
    const base = admin ? "/api/admin/reviews" : "/api/store-proxy/api/reviews";
    async function relay(endpoint: string, body: BodyInit) {
      if (admin)
        return clientApi(`${base}/${endpoint}`, { method: "POST", body }, true);
      const response = await fetch(`${base}/${endpoint}`, {
        method: "POST",
        headers:
          body instanceof FormData
            ? undefined
            : { "content-type": "application/json" },
        body,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.message ||
            result?.error ||
            `Unable to upload ${file.name}. Please retry.`,
        );
    }
    const chunkSize = 2 * 1024 * 1024;
    for (let part = 0; part < Math.ceil(file.size / chunkSize); part++) {
      const form = new FormData();
      for (const [key, value] of Object.entries(context))
        form.append(key, value);
      form.append("uploadToken", ticket.token);
      form.append("part", String(part));
      form.append(
        "chunk",
        file.slice(part * chunkSize, (part + 1) * chunkSize),
        "chunk.bin",
      );
      await relay("upload-chunk", form);
    }
    await relay(
      "upload-complete",
      JSON.stringify({ ...context, uploadToken: ticket.token }),
    );
  }
  return ticket.token;
}
export async function reviewFormPayload(form: FormData) {
  const values: Record<string, unknown> = {},
    uploadTokens: string[] = [];
  for (const [key, value] of form.entries()) {
    if (value instanceof File) {
      if (value.size)
        uploadTokens.push(
          await uploadReviewFile(value, key as "media" | "avatar", true),
        );
    } else values[key] = value;
  }
  return { ...values, uploadTokens };
}
