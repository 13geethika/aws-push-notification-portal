import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const BACKEND_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  status: "sending" | "success" | "error";
  error?: string;
}

export const NotificationPage = () => {
  const [deviceToken, setDeviceToken] = useState("");
  const [endpointArn, setEndpointArn] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [regStatus, setRegStatus] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message bubble
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load configuration, initialize FCM, request permissions and register
  useEffect(() => {
    const initializeWebPush = async () => {
      try {
        // 1. Check health of Spring Boot server
        const healthResponse = await fetch(`${BACKEND_API_URL}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (!healthResponse.ok) {
          setIsBackendOnline(false);
          setCheckingHealth(false);
          setRegStatus("Spring Boot backend offline.");
          return;
        }
        setIsBackendOnline(true);

        // 2. Fetch Firebase Web Credentials from Spring Boot config endpoint
        setRegStatus("Fetching configurations...");
        const configResponse = await fetch(`${BACKEND_API_URL}/config`);
        if (!configResponse.ok) {
          throw new Error("Failed to load Firebase configuration from Spring Boot.");
        }
        const config = await configResponse.json();

        // Validate config
        if (!config.apiKey || !config.messagingSenderId || !config.vapidKey) {
          setRegStatus("FCM Web Config not fully set in Spring Boot properties.");
          setCheckingHealth(false);
          return;
        }

        // 3. Initialize Firebase Client App
        setRegStatus("Initializing Firebase...");
        const firebaseApp = initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        });
        const messaging = getMessaging(firebaseApp);

        // Handle foreground notifications (displays popups even when looking at the tab)
        onMessage(messaging, (payload) => {
          console.log("Foreground message received:", payload);
          const notification = payload.notification;
          if (Notification.permission === "granted" && notification) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(notification.title || "New Push Message", {
                body: notification.body || "",
                icon: "/vite.svg",
              });
            });
          }
        });

        // 4. Request notification permission from user
        setRegStatus("Requesting notification permissions...");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          throw new Error("Browser notification permissions denied by user.");
        }

        // 5. Register custom Service Worker with query parameters for background push support
        setRegStatus("Registering service worker...");
        const swUrl = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(
          config.apiKey
        )}&authDomain=${encodeURIComponent(config.authDomain || "")}&projectId=${encodeURIComponent(
          config.projectId || ""
        )}&storageBucket=${encodeURIComponent(
          config.storageBucket || ""
        )}&messagingSenderId=${encodeURIComponent(
          config.messagingSenderId
        )}&appId=${encodeURIComponent(config.appId || "")}`;

        const registration = await navigator.serviceWorker.register(swUrl);

        // Wait for the service worker to become active (prevents "no active Service Worker" error)
        if (!registration.active) {
          setRegStatus("Activating service worker...");
          await new Promise<void>((resolve) => {
            const serviceWorker = registration.installing || registration.waiting;
            if (serviceWorker) {
              serviceWorker.addEventListener("statechange", (e: any) => {
                if (e.target.state === "activated") {
                  resolve();
                }
              });
            } else {
              resolve();
            }
          });
        }

        // 6. Request Web Push Registration Token from Firebase Messaging
        setRegStatus("Retrieving FCM token...");
        const fcmToken = await getToken(messaging, {
          vapidKey: config.vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (!fcmToken) {
          throw new Error("FCM returned an empty token.");
        }
        setDeviceToken(fcmToken); // Set raw device token in the input box!

        // 7. Register the token with Spring Boot to obtain AWS Platform Endpoint ARN
        setRegStatus("Registering endpoint with AWS SNS...");
        const registerResponse = await fetch(`${BACKEND_API_URL}/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceToken: fcmToken }),
        });

        const registerData = await registerResponse.json();
        if (registerResponse.ok && registerData.success) {
          // Store the generated AWS SNS Platform Endpoint ARN
          setEndpointArn(registerData.messageId); // messageId holds the registered endpointArn
          setRegStatus("Registered successfully with AWS SNS.");
        } else {
          throw new Error(registerData.error || "FCM registration with Spring Boot failed.");
        }
      } catch (err: any) {
        console.error("Web Push Initialization Error:", err);
        setRegStatus(`Error: ${err.message || String(err)}`);
      } finally {
        setCheckingHealth(false);
      }
    };

    initializeWebPush();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || !deviceToken.trim()) return;

    if (!isBackendOnline) {
      alert("Cannot send: Spring Boot API Server is offline.");
      return;
    }

    const messageText = inputValue;
    setInputValue("");

    const messageId = `msg-${Date.now()}`;
    const newMsg: ChatMessage = {
      id: messageId,
      text: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      status: "sending",
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      // POST the push message to Spring Boot
      const response = await fetch(`${BACKEND_API_URL}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceToken: endpointArn || deviceToken.trim(), // Use registered ARN under the hood, fallback to token
          message: messageText,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update bubble to success
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "success" } : msg
          )
        );
      } else {
        throw new Error(data.error || "Failed to send notification via backend API.");
      }
    } catch (err: any) {
      console.error("Spring Boot API send error:", err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, status: "error", error: err.message || String(err) }
            : msg
        )
      );
    }
  };

  return (
    <div className="notification-page">
      <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#333" }}>
        AWS Push Notification Portal
      </h2>

      {/* Connection Offline alert */}
      {!isBackendOnline && !checkingHealth && (
        <div className="alert-box error">
          <strong>Connection Offline:</strong> The Spring Boot API Server is not responding. 
          Please configure your AWS properties and launch the project on port 5000.
        </div>
      )}

      {/* Target Device Input Form */}
      <div className="form-card">
        <div className="form-group">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <label className="input-label" htmlFor="device-token">Device Token</label>
            <span style={{ fontSize: "0.75rem", color: "#666" }}>{regStatus}</span>
          </div>
          <input
            id="device-token"
            type="text"
            className="input-field"
            placeholder="Awaiting registration token..."
            value={deviceToken}
            onChange={(e) => setDeviceToken(e.target.value)}
          />
        </div>

        {/* Message composer */}
        <form onSubmit={handleSend} className="message-form-fresher">
          <div className="form-group">
            <label className="input-label" htmlFor="message-body">Type Here</label>
            <input
              id="message-body"
              type="text"
              className="input-field"
              placeholder="Type your message here..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={!deviceToken.trim() || !isBackendOnline}
            />
          </div>
          <button
            type="submit"
            className="submit-btn"
            disabled={!inputValue.trim() || !deviceToken.trim() || !isBackendOnline}
          >
            Send Notification
          </button>
        </form>
      </div>

      {/* Simple Sent Message List */}
      <div className="history-section">
        <h3 style={{ margin: "20px 0 10px", color: "#444", fontSize: "1.1rem", borderBottom: "1px solid #ddd", paddingBottom: "5px" }}>
          Sent Messages
        </h3>
        {messages.length === 0 ? (
          <p style={{ color: "#888", fontSize: "0.85rem", textAlign: "center", padding: "15px" }}>
            No messages sent in this session.
          </p>
        ) : (
          <ul style={{ listStyleType: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map((msg) => (
              <li
                key={msg.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: "6px",
                  backgroundColor: "#f9f9f9",
                  border: "1px solid #eee",
                  fontSize: "0.9rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: "#222" }}>{msg.text}</span>
                  <span style={{ fontSize: "0.75rem", color: "#888", marginLeft: "10px" }}>({msg.timestamp})</span>
                </div>
                <div style={{ fontSize: "0.8rem", fontWeight: "bold" }}>
                  {msg.status === "sending" && <span style={{ color: "#3b82f6" }}>Sending...</span>}
                  {msg.status === "success" && <span style={{ color: "#10b981" }}>✓ Sent</span>}
                  {msg.status === "error" && (
                    <span style={{ color: "#ef4444" }} title={msg.error}>
                      ✕ Failed
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationPage;
