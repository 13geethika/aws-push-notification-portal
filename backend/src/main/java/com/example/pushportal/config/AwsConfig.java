package com.example.pushportal.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sqs.SqsClient;

@Configuration
public class AwsConfig {

    @Value("${aws.accessKeyId:}")
    private String accessKeyId;

    @Value("${aws.secretAccessKey:}")
    private String secretAccessKey;

    @Value("${aws.region:us-east-1}")
    private String region;

    @Bean
    public SqsClient sqsClient() {
        String accessKey = accessKeyId != null ? accessKeyId.trim() : "";
        String secretKey = secretAccessKey != null ? secretAccessKey.trim() : "";

        AwsCredentialsProvider credentialsProvider;
        if (!accessKey.isEmpty() && !secretKey.isEmpty()) {
            // Use manually configured credentials from properties/environment variables
            AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKey, secretKey);
            credentialsProvider = StaticCredentialsProvider.create(credentials);
        } else {
            // Fallback to standard AWS credential provider chain (checks ~/.aws/credentials, environment, profile roles)
            credentialsProvider = DefaultCredentialsProvider.create();
        }

        return SqsClient.builder()
                .region(Region.of(region.trim()))
                .credentialsProvider(credentialsProvider)
                .build();
    }
}
