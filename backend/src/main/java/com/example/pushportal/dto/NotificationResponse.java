package com.example.pushportal.dto;

/**
 * Record representing the API response for push notification requests.
 */
public record NotificationResponse(boolean success, String messageId, String error) {}
