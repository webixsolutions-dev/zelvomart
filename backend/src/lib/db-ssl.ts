import type { ConnectionOptions } from "node:tls";

/**
 * TLS for every Postgres connection (Prisma pool, pg-boss, scripts): the server certificate is verified
 * against Supabase's root CA ("Supabase Root 2021 CA", valid to 26 Apr 2031,
 * SHA-256 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA),
 * downloaded from https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt.
 *
 * - DATABASE_CA_CERT (optional): a PEM to use instead, e.g. after Supabase rotates its CA.
 * - DATABASE_SSL_VERIFY=false (emergency only): back to encrypted-but-unverified, with a warning in the logs.
 */
export const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

/** Whether this connection string should use TLS at all (Supabase hosts, or DATABASE_SSL=true). */
export function databaseUsesSsl(connectionString = "") {
  return process.env.DATABASE_SSL === "true" || /supabase\.(co|com)/i.test(connectionString);
}

let warned = false;

/** The `ssl` option for node-postgres. */
export function databaseSsl(): ConnectionOptions {
  if (process.env.DATABASE_SSL_VERIFY === "false") {
    if (!warned) {
      warned = true;
      console.warn("[db] DATABASE_SSL_VERIFY=false: the database certificate is NOT verified. Remove it once the connection works.");
    }
    return { rejectUnauthorized: false };
  }
  const ca = process.env.DATABASE_CA_CERT?.trim() || SUPABASE_ROOT_CA;
  return { ca, rejectUnauthorized: true };
}

/**
 * The connection string without its own TLS parameters. node-postgres lets `sslmode` and friends in the URL
 * override the `ssl` option, so they are removed and `databaseSsl()` decides alone.
 */
export function withoutSslParams(connectionString = "") {
  try {
    const url = new URL(connectionString);
    for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return connectionString;
  }
}

/** Connection settings for a node-postgres Pool or pg-boss: the URL plus verified TLS when it applies. */
export function databaseConnection(connectionString = "") {
  return databaseUsesSsl(connectionString)
    ? { connectionString: withoutSslParams(connectionString), ssl: databaseSsl() }
    : { connectionString };
}
