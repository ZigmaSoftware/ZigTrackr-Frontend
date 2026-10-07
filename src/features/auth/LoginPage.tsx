import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useAuth } from "@/features/auth/AuthContext";
import { apiErrorMessage } from "@/api/client";
import { setupLoginAnimations } from "./loginAnimations";
import "./LoginPage.css";

const schema = z.object({
  username: z.string().trim().min(1, "Enter your username or email"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean().optional(),
});

type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) });

  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pageRef.current) return;
    const previousTitle = document.title;
    document.title = "ZigTrackr — Secure Access";
    const cleanup = setupLoginAnimations(pageRef.current);
    return () => {
      cleanup();
      document.title = previousTitle;
    };
  }, []);

  if (!isLoading && user) {
    const from =
      (location.state as { from?: string } | null)?.from ?? "/dashboard";
    return <Navigate to={from} replace />;
  }

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      await login(values.username, values.password);
      const from =
        (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(from, { replace: true });
    } catch (error) {
      // Rate limiting is the one case worth distinguishing; everything else
      // stays deliberately generic (spec 20.5).
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        setFormError("Too many attempts. Please wait a minute and try again.");
      } else {
        setFormError(apiErrorMessage(error, "Invalid username or password."));
      }
    }
  }

  return (
    <div className="zigma-login" ref={pageRef}>
      <div className="page" id="page">
        {/* Background video. muted + playsinline + loop are what allow
            autoplay without a user gesture in every browser. VP9 first --
            on this gradient footage it holds the gradient better than H.264
            at under half the size -- with MP4 as the Safari fallback.
            The 0.8x slowdown is baked into the files at encode time rather
            than set via playbackRate, which would resample on the fly and
            judder. */}
        <video
          className="bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src="/login-bg.webm" type="video/webm" />
          <source src="/login-bg.mp4" type="video/mp4" />
        </video>

        <div className="ambient" aria-hidden="true">
          <div className="ambient__orb ambient__orb--a" data-orb="a"></div>
          <div className="ambient__orb ambient__orb--b" data-orb="b"></div>
        </div>

        <canvas
          className="neon-field"
          id="neonField"
          aria-hidden="true"
        ></canvas>
        <div className="neon-cursor" id="neonCursor" aria-hidden="true"></div>
        <div className="cursor-lens" id="cursorLens" aria-hidden="true"></div>

        <header className="topbar">
          <a className="brand" href="#" aria-label="ZigTrackr home">
            <span className="brand__mark" id="brandMark">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
                <path
                  d="M12 2.4v2.8M12 18.8v2.8M21.6 12h-2.8M5.2 12H2.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="brand__copy">
              <strong>ZigTrackr</strong>
              <span>Issue Intelligence Workspace</span>
            </span>
          </a>
        </header>

        <main className="layout">
          <section className="showcase" aria-labelledby="page-title">
            <div className="showcase__copy">
              <div className="eyebrow reveal">
                Track. Assign. Resolve. Verify.
              </div>
              <h1 className="headline" id="page-title">
                <span className="line">
                  <span>Every issue becomes</span>
                </span>
                <span className="line">
                  <span className="accent">visible, owned, resolved.</span>
                </span>
              </h1>
              <p className="showcase__subcopy reveal">
                A single operational workspace for bug intake, assignment,
                developer updates, controlled testing, closure and audit-ready
                history.
              </p>
            </div>

            <div className="scene" id="scene" aria-hidden="true">
              <div className="scene__floor"></div>
              <div className="scene__halo"></div>

              <div className="signal-field" id="signalField">
                <div
                  className="signal-word signal-word--track"
                  data-word="TRACK"
                >
                  TRACK
                </div>
                <div
                  className="signal-word signal-word--assign"
                  data-word="ASSIGN"
                >
                  ASSIGN
                </div>
                <div className="signal-word signal-word--test" data-word="TEST">
                  TEST
                </div>
                <div
                  className="signal-word signal-word--resolve"
                  data-word="RESOLVE"
                >
                  RESOLVE
                </div>

                <div className="workflow-axis">
                  <div className="workflow-axis__line"></div>
                  <div className="workflow-axis__packet"></div>
                  <span className="workflow-step workflow-step--1">Intake</span>
                  <span className="workflow-step workflow-step--2">
                    Assigned
                  </span>
                  <span className="workflow-step workflow-step--3">
                    Testing
                  </span>
                  <span className="workflow-step workflow-step--4">
                    Verified
                  </span>
                </div>

                <div className="scene-note">
                  <strong>Live issue lifecycle</strong> · cursor-reactive signal
                  field
                </div>
              </div>
            </div>

            <div className="showcase__footer reveal">
              <span>Manual + Email Intake</span>
              <i></i>
              <span>Controlled workflow</span>
              <i></i>
              <span>Complete audit trail</span>
            </div>
          </section>

          <section className="auth-wrap" aria-labelledby="login-title">
            <div className="auth-shell" id="authShell">
              <div className="auth-card" id="authCard">
                <div className="scanbeam" aria-hidden="true"></div>
                <div className="corner-code" aria-hidden="true">
                  RBAC / AUDIT / SECURE
                </div>

                <div className="auth-card__topline reveal">
                  <div className="auth-card__secure">
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M7.5 10V7.8A4.5 4.5 0 0 1 12 3.3a4.5 4.5 0 0 1 4.5 4.5V10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <rect
                        x="5"
                        y="10"
                        width="14"
                        height="10"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M12 14v2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    Protected access
                  </div>
                  <span className="auth-card__index">ZT / 01</span>
                </div>

                <div className="reveal">
                  <h2 className="auth-title" id="login-title">
                    Welcome back.
                  </h2>
                  <p className="auth-copy">
                    Sign in to continue to the issue intelligence workspace.
                  </p>
                </div>

                <form
                  className="form"
                  id="loginForm"
                  noValidate
                  onSubmit={handleSubmit(onSubmit)}
                  aria-busy={isSubmitting}
                >
                  {formError && (
                    <p className="login-error" role="alert">
                      {formError}
                    </p>
                  )}
                  <div className="field reveal">
                    <label htmlFor="username">Username or email</label>
                    <div className="input-shell">
                      <div className="input-core">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle
                            cx="12"
                            cy="8"
                            r="3.6"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M5.5 19c.8-4 3.2-6 6.5-6s5.7 2 6.5 6"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                        <input
                          id="username"
                          {...register("username")}
                          aria-invalid={Boolean(errors.username)}
                          aria-describedby={
                            errors.username ? "username-error" : undefined
                          }
                          type="text"
                          autoComplete="username"
                          placeholder="Enter your username"
                          required
                          aria-required="true"
                        />
                      </div>
                    </div>
                    {errors.username && (
                      <p
                        id="username-error"
                        className="login-error"
                        role="alert"
                      >
                        {errors.username.message}
                      </p>
                    )}
                  </div>

                  <div className="field reveal">
                    <label htmlFor="password">Password</label>
                    <div className="input-shell">
                      <div className="input-core">
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M7.5 10V7.8A4.5 4.5 0 0 1 12 3.3a4.5 4.5 0 0 1 4.5 4.5V10"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                          <rect
                            x="5"
                            y="10"
                            width="14"
                            height="10"
                            rx="3"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                        </svg>
                        <input
                          id="password"
                          {...register("password")}
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={
                            errors.password ? "password-error" : undefined
                          }
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          required
                          aria-required="true"
                        />
                        <button
                          className="password-toggle"
                          id="passwordToggle"
                          type="button"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          <svg
                            id="eyeIcon"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M3.5 12s3-5 8.5-5 8.5 5 8.5 5-3 5-8.5 5-8.5-5-8.5-5Z"
                              stroke="currentColor"
                              strokeWidth="1.4"
                            />
                            <circle
                              cx="12"
                              cy="12"
                              r="2.2"
                              stroke="currentColor"
                              strokeWidth="1.4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {errors.password && (
                      <p
                        id="password-error"
                        className="login-error"
                        role="alert"
                      >
                        {errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="form-row reveal">
                    <label className="check">
                      <input
                        id="remember"
                        type="checkbox"
                        {...register("remember")}
                      />
                      <span className="check__box" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="m6.8 12.1 3.1 3 7.3-7"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span>Remember me</span>
                    </label>
                  </div>

                  <button
                    className="submit reveal"
                    id="submitButton"
                    type="submit"
                    disabled={isSubmitting}
                    /* CSS user-select stops NEW selections but cannot clear one
                       that already covers the button -- a drag beginning
                       outside it still paints the label. Collapsing the
                       selection on mousedown removes it in that case too. */
                    onMouseDown={() => window.getSelection()?.removeAllRanges()}
                  >
                    <span className="submit__label" id="submitLabel">
                      {isSubmitting ? "Authenticating" : "Enter workspace"}
                    </span>
                    <span className="submit__icon">
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M5 12h13M14 8l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span
                      className="submit__progress"
                      id="submitProgress"
                    ></span>
                  </button>
                </form>

                <div className="auth-foot reveal">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 3.5 19 6v5.4c0 4.2-2.8 7.5-7 9.1-4.2-1.6-7-4.9-7-9.1V6l7-2.5Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <path
                      d="m9.3 12.1 1.8 1.8 3.8-4"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Secure sign-in · Backend-enforced permissions
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
