import React, { useState } from "react";
import TransNavbarAbout from "../Components/TransNavbarAbout";
import useIsMobile from "../hooks/useIsMobile";
import { useNavigate } from "react-router-dom";

import AnimatedGradientLogin from "./AnimatedGradientLogin";
import "./Flip.css";
import "./Login.css"; // if you need old styles

function NLogin() {
      console.log("NLogin loaded");
      const isMobile = useIsMobile();
      const navigate = useNavigate();

  const [isSignup, setIsSignup] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // After login
  const [showClientForm, setShowClientForm] = useState(false); // After signup
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupIsLawyer, setSignupIsLawyer] = useState(false);
  const [error, setError] = useState("");
  const [shakeLogin, setShakeLogin] = useState(false);
  const [shakeSignup, setShakeSignup] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

  async function handleLogin() {
    try {
      setError("");
      if (!loginEmail || !loginPassword) {
        setError("Please enter email and password");
        setShakeLogin(true);
        setTimeout(() => setShakeLogin(false), 400);
        return;
      }
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setShakeLogin(true);
        setTimeout(() => setShakeLogin(false), 400);
        throw new Error(err.error || `Login failed (${res.status})`);
      }
      const data = await res.json();
      // In a real app, persist token securely (e.g., httpOnly cookie or secure storage)
      localStorage.setItem("token", data.token);
      setIsLoggedIn(true);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message || "Login failed");
      setShakeLogin(true);
      setTimeout(() => setShakeLogin(false), 400);
    }
  }

  async function handleSignup() {
    try {
      setError("");
      if (!signupFullName || !signupEmail || !signupPassword) {
        setError("Please fill all required signup fields");
        setShakeSignup(true);
        setTimeout(() => setShakeSignup(false), 400);
        return;
      }
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: signupFullName,
          email: signupEmail,
          password: signupPassword,
          isLawyer: signupIsLawyer,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setShakeSignup(true);
        setTimeout(() => setShakeSignup(false), 400);
        throw new Error(err.error || `Signup failed (${res.status})`);
      }
      const data = await res.json();
      localStorage.setItem("token", data.token);
      // After signup, either go to dashboard or flip to login; we'll go to dashboard
      navigate("/dashboard");
    } catch (e) {
      setError(e.message || "Signup failed");
      setShakeSignup(true);
      setTimeout(() => setShakeSignup(false), 400);
    }
  }

  return (
    <AnimatedGradientLogin>
      {isMobile && <TransNavbarAbout />}
      <div className={`relative z-10 flex items-center justify-center min-h-screen ${isMobile ? "pb-20" : ""}`}>
        {!showClientForm ? (
          !isLoggedIn ? (
            <div className={`flip-container ${isSignup ? "flipped" : ""}`}>
              <div className="flipper">
                {/* FRONT: LOGIN FORM */}
                <div className={`form-container front bg-white/80 backdrop-blur-lg shadow-xl p-8 rounded-md border border-white/30 ${shakeLogin ? "shake" : ""}`}>
                  <p className="title text-2xl font-bold mb-4">Login</p>
                  <form className="form space-y-4" onSubmit={(e) => e.preventDefault()}>
                    <div className="input-group">
                      <label htmlFor="email" className="block text-sm font-medium">Email</label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        className="w-full p-2 border rounded"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="password" className="block text-sm font-medium">Password</label>
                      <input
                        type="password"
                        name="password"
                        id="password"
                        className="w-full p-2 border rounded"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                      <div className="forgot text-right mt-1">
                        <a href="#" className="text-blue-500 text-sm">Forgot Password?</a>
                      </div>
                    </div>
                    <button
                      type="submit"
                      onClick={handleLogin}
                      className="sign w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                    >
                      Sign in
                    </button>
                    {error && (
                      <p className="text-red-600 text-sm mt-3" role="alert">{error}</p>
                    )}
                    <p className="signup mt-6 text-sm text-center">
                      Don't have an account? {" "}
                      <button className="text-blue-500" onClick={() => setIsSignup(true)}>Sign up</button>
                    </p>
                  </form>
                </div>
                {/* BACK: SIGNUP FORM */}
                <div className={`form-container back bg-white/80 backdrop-blur-lg shadow-xl p-8 rounded-md ${shakeSignup ? "shake" : ""}`}>
                  <p className="title text-2xl font-bold mb-4">Create Account</p>
                  <form className="form space-y-4" onSubmit={(e) => e.preventDefault()}>
                    <div className="input-group">
                      <label htmlFor="fullName" className="block text-sm font-medium">Full Name</label>
                      <input
                        type="text"
                        name="fullName"
                        id="fullName"
                        className="w-full p-2 border rounded"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="signupEmail" className="block text-sm font-medium">Email</label>
                      <input
                        type="email"
                        name="email"
                        id="signupEmail"
                        className="w-full p-2 border rounded"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="passwordSignup" className="block text-sm font-medium">Password</label>
                      <input
                        type="password"
                        name="passwordSignup"
                        id="passwordSignup"
                        className="w-full p-2 border rounded"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isLawyer"
                        className="mr-2"
                        checked={signupIsLawyer}
                        onChange={(e) => setSignupIsLawyer(e.target.checked)}
                      />
                      <label htmlFor="isLawyer" className="text-sm">I am a lawyer</label>
                    </div>
                    <button
                      type="submit"
                      onClick={handleSignup}
                      className="sign w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
                    >
                      Sign Up
                    </button>
                  </form>
                  {error && (
                    <p className="text-red-600 text-sm mt-3" role="alert">{error}</p>
                  )}
                  <p className="signup mt-6 text-sm text-center">
                    Already have an account? {" "}
                    <button className="text-blue-500" onClick={() => setIsSignup(false)}>Login</button>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <h1 className="text-white text-3xl">Welcome Back!</h1>
          )
        ) : (
          // Show Client Details Form
          <div className="form-container bg-white/80 backdrop-blur-lg shadow-xl p-8 rounded-md border border-white/30 w-[400px] max-w-md mx-auto">
            <p className="title text-2xl font-bold mb-4 text-center">Client Details</p>
            <form className="form space-y-4">
              <div className="input-group">
                <label className="block text-sm font-medium">Full Name</label>
                <input
                  type="text"
                  className="w-full p-3 border rounded bg-gray-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your full name"
                />
              </div>
              <div className="input-group">
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  className="w-full p-3 border rounded bg-gray-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                />
              </div>
              <div className="input-group">
                <label className="block text-sm font-medium">Contact</label>
                <input
                  type="tel"
                  className="w-full p-3 border rounded bg-gray-900 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your contact number"
                />
              </div>
              <div className="input-group">
                <label className="block text-sm font-medium">Case Category</label>
                <select className="w-full p-3 border rounded bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Select Category</option>
                  <option>Civil</option>
                  <option>Criminal</option>
                  <option>Corporate</option>
                  <option>Family</option>
                  <option>Others</option>
                </select>
              </div>
              <button className="w-full bg-purple-600 text-white py-3 rounded hover:bg-purple-700 transition">
                Submit
              </button>
            </form>
          </div>
        )}
      </div>
    </AnimatedGradientLogin>
  );
}

export default NLogin;
