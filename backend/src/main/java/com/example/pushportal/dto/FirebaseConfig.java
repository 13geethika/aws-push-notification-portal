package com.example.pushportal.dto;

/**
 * Record representing the Firebase client configuration returned to the frontend.
 */
public record FirebaseConfig(
    String apiKey,
    String authDomain,
    String projectId,
    String storageBucket,
    String messagingSenderId,
    String appId,
    String vapidKey
) {}
