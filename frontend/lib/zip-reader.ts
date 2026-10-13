// Minimal ZIP reader for the admin bulk image upload. Reads the file in slices in the
// browser (nothing is sent to the server) and inflates entries with DecompressionStream.

export type ZipEntry = {
  /** Path inside the ZIP, always with forward slashes. */
  path: string;
  size: number;
  blob: () => Promise<Blob>;
  /** First bytes of the file, enough to recognise its real format. */
  head: () => Promise<Uint8Array>;
};

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

async function view(file: Blob, start: number, end: number) {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

export async function readZip(file: File): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, file.size - 65_557);
  const tail = await view(file, tailStart, file.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i -= 1) {
    if (tail.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`"${file.name}" is not a valid ZIP file.`);

  const count = tail.getUint16(eocd + 10, true);
  const directorySize = tail.getUint32(eocd + 12, true);
  const directoryOffset = tail.getUint32(eocd + 16, true);
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new Error(`"${file.name}" is too large (ZIP64). Split it into ZIPs under 4 GB and 65,000 files.`);
  }

  const directory = await view(file, directoryOffset, directoryOffset + directorySize);
  const utf8 = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > directory.byteLength || directory.getUint32(cursor, true) !== CENTRAL_SIGNATURE) {
      throw new Error(`"${file.name}" has a damaged file list.`);
    }
    const flags = directory.getUint16(cursor + 8, true);
    const method = directory.getUint16(cursor + 10, true);
    const compressedSize = directory.getUint32(cursor + 20, true);
    const size = directory.getUint32(cursor + 24, true);
    const nameLength = directory.getUint16(cursor + 28, true);
    const extraLength = directory.getUint16(cursor + 30, true);
    const commentLength = directory.getUint16(cursor + 32, true);
    const localOffset = directory.getUint32(cursor + 42, true);
    const nameBytes = new Uint8Array(directory.buffer, directory.byteOffset + cursor + 46, nameLength);
    const path = utf8.decode(nameBytes).replace(/\\/g, "/").replace(/^\/+/, "");
    cursor += 46 + nameLength + extraLength + commentLength;

    if (!path || path.endsWith("/")) continue;
    if (flags & 1) throw new Error(`"${file.name}" is password-protected. Create the ZIP again without a password.`);

    // Returns the stored bytes, or a stream of the inflated bytes for a compressed entry.
    const open = async (): Promise<Blob | ReadableStream<Uint8Array>> => {
      const local = await view(file, localOffset, localOffset + 30);
      if (local.byteLength < 30 || local.getUint32(0, true) !== LOCAL_SIGNATURE) throw new Error("the ZIP entry is damaged");
      const start = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
      const data = file.slice(start, start + compressedSize);
      if (method === 0) return data;
      if (method !== 8) throw new Error("unsupported ZIP compression (use normal Deflate)");
      if (typeof DecompressionStream === "undefined") throw new Error("this browser cannot open ZIP files; use the folder option or update the browser");
      return (data.stream() as ReadableStream<any>).pipeThrough(new DecompressionStream("deflate-raw") as any) as ReadableStream<Uint8Array>;
    };

    entries.push({
      path,
      size,
      blob: async () => {
        const source = await open();
        const blob = source instanceof Blob ? source : await new Response(source).blob();
        if (blob.size !== size) throw new Error("the ZIP entry is damaged");
        return blob;
      },
      head: async () => {
        const source = await open();
        if (source instanceof Blob) return new Uint8Array(await source.slice(0, 16).arrayBuffer());
        const reader = source.getReader();
        const bytes: number[] = [];
        while (bytes.length < 16) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes.push(...value.subarray(0, 16 - bytes.length));
        }
        await reader.cancel().catch(() => undefined);
        return new Uint8Array(bytes);
      },
    });
  }
  return entries;
}
