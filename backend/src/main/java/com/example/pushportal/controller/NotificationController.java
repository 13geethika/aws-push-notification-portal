package com.example.pushportal.controller;

import com.example.pushportal.dto.FirebaseConfig;
import com.example.pushportal.dto.NotificationRequest;
import com.example.pushportal.dto.NotificationResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;
import software.amazon.awssdk.services.sqs.model.SendMessageResponse;
import software.amazon.awssdk.services.sqs.model.SqsException;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Cross-origin resource sharing support for React dev client
public class NotificationController {

    private final SqsClient sqsClient;

    @Value("${aws.sqsQueueUrl:}")
    private String sqsQueueUrl;

    // Firebase Web Configurations
    @Value("${firebase.apiKey:}")
    private String apiKey;

    @Value("${firebase.authDomain:}")
    private String authDomain;

    @Value("${firebase.projectId:}")
    private String projectId;

    @Value("${firebase.storageBucket:}")
    private String storageBucket;

    @Value("${firebase.messagingSenderId:}")
    private String messagingSenderId;

    @Value("${firebase.appId:}")
    private String appId;

    @Value("${firebase.vapidKey:}")
    private String vapidKey;

    @Autowired
    public NotificationController(SqsClient sqsClient) {
        this.sqsClient = sqsClient;
    }

    /**
     * Endpoint to check connection health status.
     */
    @GetMapping("/health")
    public ResponseEntity<MapResponse> healthCheck() {
        return ResponseEntity.ok(new MapResponse("OK"));
    }

    /**
     * Endpoint to fetch the Firebase Web Client configurations for initialization in React.
     */
    @GetMapping("/config")
    public ResponseEntity<FirebaseConfig> getFirebaseConfig() {
        return ResponseEntity.ok(new FirebaseConfig(
                apiKey,
                authDomain,
                projectId,
                storageBucket,
                messagingSenderId,
                appId,
                vapidKey
        ));
    }

    /**
     * Endpoint to register a device token.
     * With SQS+Lambda, token registration is deferred asynchronously to Lambda.
     * We simply return success immediately to keep the UI state happy.
     */
    @PostMapping("/register")
    public ResponseEntity<NotificationResponse> registerDevice(@RequestBody NotificationRequest request) {
        if (request.deviceToken() == null || request.deviceToken().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new NotificationResponse(false, null, "Device token is required"));
        }
        return ResponseEntity.ok(new NotificationResponse(true, request.deviceToken().trim(), null));
    }

    /**
     * Endpoint to send a push notification.
     * Serializes the request and enqueues it to Amazon SQS.
     */
    @PostMapping("/send")
    public ResponseEntity<NotificationResponse> sendNotification(@RequestBody NotificationRequest request) {
        if (request.deviceToken() == null || request.deviceToken().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new NotificationResponse(false, null, "Device token is required"));
        }
        if (request.message() == null || request.message().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(new NotificationResponse(false, null, "Message text is required"));
        }
        if (sqsQueueUrl == null || sqsQueueUrl.trim().isEmpty()) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new NotificationResponse(false, null, "AWS SQS Queue URL is not configured."));
        }

        try {
            // Construct the JSON payload representing the task
            String jsonPayload = "{"
                    + "\"deviceToken\":\"" + escapeJson(request.deviceToken().trim()) + "\","
                    + "\"message\":\"" + escapeJson(request.message().trim()) + "\""
                    + "}";

            // Send enqueued task to the SQS queue
            SendMessageRequest sendMessageRequest = SendMessageRequest.builder()
                    .queueUrl(sqsQueueUrl.trim())
                    .messageBody(jsonPayload)
                    .build();

            SendMessageResponse sendResult = sqsClient.sendMessage(sendMessageRequest);

            return ResponseEntity.ok(new NotificationResponse(true, sendResult.messageId(), null));

        } catch (SqsException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new NotificationResponse(false, null, "AWS SQS SDK Exception: " + e.awsErrorDetails().errorMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new NotificationResponse(false, null, "Server Exception: " + e.getMessage()));
        }
    }

    /**
     * Helper utility to escape special characters for JSON validation.
     */
    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r");
    }

    // Simple DTO for health status helper
    private static class MapResponse {
        private String status;
        public MapResponse(String status) { this.status = status; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }
}
