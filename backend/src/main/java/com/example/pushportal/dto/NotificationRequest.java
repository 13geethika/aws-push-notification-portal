package com.example.pushportal.dto;

/**
 * Record representing the request payload for sending a push notification.
 */
public record NotificationRequest(String deviceToken, String message) {}
