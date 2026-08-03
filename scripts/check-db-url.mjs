import "dotenv/config";

const u = process.env.DATABASE_URL;
if (!u) {
  console.log("DATABASE_URL: MISSING");
  process.exit(1);
}

console.log("length:", u.length);
console.log("startsWith_postgres:", /^postgres(ql)?:\/\//i.test(u));
console.log("at_symbols:", (u.match(/@/g) || []).length);
console.log("has_space:", /\s/.test(u));
console.log("wrapped_quotes:", /^["']/.test(u.trim()) || /["']$/.test(u.trim()));

try {
  const parsed = new URL(u);
  console.log("protocol:", parsed.protocol);
  console.log("username:", parsed.username);
  console.log("hostname:", parsed.hostname);
  console.log("port:", parsed.port || "(default)");
  console.log("db_name:", parsed.pathname);
  console.log("password_len:", parsed.password.length);
  if (!parsed.hostname || parsed.hostname === "base" || parsed.hostname.length < 8) {
    console.log(
      "DIAGNOSIS: hostname looks wrong. Usually the DB password has @ # % / or similar and must be URL-encoded.",
    );
  }
} catch (e) {
  console.log("URL_PARSE_ERROR:", e instanceof Error ? e.message : e);
}
