import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

export default function LoginPage() {
  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        redirectTo: "/admin",
      });
    } catch (error) {
      if (error instanceof AuthError) redirect("/admin/login?error=1");
      throw error;
    }
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-brand">
          <span className="admin-login-mark">Z</span>
          <div>
            <b>ZELVOMART</b>
            <small>Admin Portal</small>
          </div>
        </div>
        <div className="admin-login-copy">
          <span>Welcome back</span>
          <h1>Sign in to your dashboard</h1>
          <p>Manage orders, products, customers and store operations.</p>
        </div>
        <form action={login} className="admin-login-form">
          <label><span>Email address</span><input type="email" name="email" placeholder="owner@zelvomart.com" autoComplete="email" required /></label>
          <label><span>Password</span><input type="password" name="password" placeholder="Enter your password" autoComplete="current-password" required /></label>
          <button type="submit">Sign in</button>
        </form>
        <div className="admin-login-foot">Secure staff access • Zelvomart</div>
      </div>
    </div>
  );
}
