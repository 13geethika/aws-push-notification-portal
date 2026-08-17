package com.example.pushportal;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;

@SpringBootApplication
public class PushPortalApplication {
    public static void main(String[] args) {
        String envFile = ".env"; // Default fallback
        boolean debugMode = false;

        // Parse arguments to select environment
        for (String arg : args) {
            if ("--dev".equalsIgnoreCase(arg)) {
                envFile = ".env.dev";
            } else if ("--prod".equalsIgnoreCase(arg)) {
                envFile = ".env.prod";
            } else if ("--debug".equalsIgnoreCase(arg)) {
                envFile = ".env.debug";
                debugMode = true;
            }
        }

        // Load env variables
        loadDotenv(envFile);

        // Enable debug mode logging level dynamically if requested
        if (debugMode) {
            System.setProperty("logging.level.root", "DEBUG");
            System.setProperty("logging.level.com.example.pushportal", "DEBUG");
            System.out.println("[DEBUG] Verbose debug logging has been activated.");
        }

        SpringApplication.run(PushPortalApplication.class, args);
    }

    private static void loadDotenv(String filename) {
        // Attempt to find the file in multiple common execution paths:
        // 1. Current working dir (root folder)
        // 2. Child folder (if run from parent)
        // 3. Parent folder (if run from child)
        File file = new File(filename);
        if (!file.exists()) {
            file = new File("backend/" + filename);
            if (!file.exists()) {
                file = new File("../" + filename);
                if (!file.exists()) {
                    System.out.println("[WARN] Environmental configuration file not found: " + filename + ". Falling back to system environment variables.");
                    return;
                }
            }
        }

        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                // Ignore comments and empty lines
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                int eqIndex = line.indexOf('=');
                if (eqIndex > 0) {
                    String key = line.substring(0, eqIndex).trim();
                    String value = line.substring(eqIndex + 1).trim();
                    // Remove quotes if present
                    if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
                        value = value.substring(1, value.length() - 1);
                    } else if (value.startsWith("'") && value.endsWith("'") && value.length() >= 2) {
                        value = value.substring(1, value.length() - 1);
                    }
                    System.setProperty(key, value);
                }
            }
            System.out.println("[INFO] Successfully loaded configuration profile from " + file.getCanonicalPath());
        } catch (IOException e) {
            System.err.println("[ERROR] Failed to read environment file " + filename + ": " + e.getMessage());
        }
    }
}
