import Link from "next/link";
import { AUTH_RETURN_TO, authLoginHref, authProviders } from "@/lib/auth-providers";
import { ProviderIcon } from "@/components/provider-icon";
import { OpenModsMark } from "@/components/landing/hero-content";
import "./auth-screen.css";

type AuthScreenProps = {
  mode: "signin" | "signup";
};

export function AuthScreen({ mode }: AuthScreenProps) {
  const isSignup = mode === "signup";
  const otherHref = isSignup ? "/sign-in" : "/sign-up";
  const otherLabel = isSignup ? "Log In" : "Sign Up";
  const emailProvider = authProviders.find((provider) => provider.id === "email")!;
  const visibleProviders = ["google", "github", "gitlab", "bitbucket"] as const;

  function providerButton(id: (typeof authProviders)[number]["id"]) {
    const provider = authProviders.find((item) => item.id === id)!;
    return (
      <a key={id} href={authLoginHref(mode, provider.connection)} className="auth-button auth-provider">
        <ProviderIcon id={id} />
        <span>Continue with {provider.name}</span>
      </a>
    );
  }

  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link href="/" aria-label="OpenMods home" className="auth-logo"><OpenModsMark /></Link>
        <Link href={otherHref} className="auth-switch">{otherLabel}</Link>
      </header>
      <main className="auth-main">
        <section className="auth-form" aria-labelledby="auth-title">
          <h1 id="auth-title">{isSignup ? "Sign up for OpenMods" : "Log in to OpenMods"}</h1>
          <form action="/auth/login" method="get" className="auth-email">
            <input type="hidden" name="connection" value={emailProvider.connection} />
            <input type="hidden" name="returnTo" value={AUTH_RETURN_TO} />
            {isSignup && <input type="hidden" name="screen_hint" value="signup" />}
            <label className="sr-only" htmlFor="auth-email">Email Address</label>
            <input id="auth-email" name="login_hint" type="email" autoComplete="email" placeholder="Email Address" required />
            <button className="auth-button auth-email-button" type="submit">Continue with Email</button>
          </form>
          <div className="auth-divider" />
          <div className="auth-providers">{visibleProviders.map(providerButton)}</div>
          <p className="auth-footer">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <Link href={otherHref}>{otherLabel}</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
