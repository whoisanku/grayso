import { identity } from "deso-protocol";
import { Platform } from "react-native";

const UPLOAD_IMAGE_ENDPOINT = "https://node.deso.org/api/v0/upload-image";

export const uploadImage = async (
    userPublicKey: string,
    imageUri: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        try {
            const jwt = await identity.jwt();
            if (!jwt) {
                reject(new Error("Failed to get JWT for image upload"));
                return;
            }

            const formData = new FormData();
            formData.append("UserPublicKeyBase58Check", userPublicKey);
            formData.append("JWT", jwt);

            const filename = imageUri.split("/").pop() || "image.jpg";
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : "image/jpeg";

            if (Platform.OS === "web") {
                const response = await fetch(imageUri);
                const blob = await response.blob();
                const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type || type });
                formData.append("file", file, filename);
            } else {
                formData.append("file", {
                    uri: imageUri,
                    name: filename,
                    type,
                } as any);
            }

            const xhr = new XMLHttpRequest();
            xhr.open("POST", UPLOAD_IMAGE_ENDPOINT);

            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        onProgress(event.loaded / event.total);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.ImageURL) {
                            resolve(data.ImageURL);
                        } else {
                            reject(new Error("No ImageURL in upload response"));
                        }
                    } catch (e) {
                        reject(new Error("Failed to parse upload response"));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error("Network error during upload"));
            };

            xhr.send(formData);
        } catch (error) {
            reject(error);
        }
    });
};

const UPLOAD_VIDEO_ENDPOINT = "https://node.deso.org/api/v0/upload-video";

export const uploadVideo = async (
    userPublicKey: string,
    videoUri: string,
    onProgress?: (progress: number) => void
): Promise<string> => {
    try {
        const jwt = await identity.jwt();
        if (!jwt) throw new Error("Failed to get JWT for video upload");

        const filename = videoUri.split("/").pop() || "video.mp4";

        // For video, we still use fetch for the initial POST as it's small
        const fileResponse = await fetch(videoUri);
        const blob = await fileResponse.blob();
        const fileSize = blob.size;

        const initHeaders = new Headers();
        initHeaders.append("Tus-Resumable", "1.0.0");
        initHeaders.append("Upload-Length", fileSize.toString());
        initHeaders.append("Upload-Metadata", `filename ${btoa(filename)},filetype ${btoa("video/mp4")},jwt ${btoa(jwt)},userPublicKeyBase58Check ${btoa(userPublicKey)}`);

        const initResponse = await fetch(UPLOAD_VIDEO_ENDPOINT, {
            method: "POST",
            headers: initHeaders,
        });

        if (!initResponse.ok) {
            const text = await initResponse.text();
            throw new Error(`Video upload init failed: ${initResponse.status} ${text}`);
        }

        const uploadUrl = initResponse.headers.get("Location");
        if (!uploadUrl) {
            throw new Error("No Location header in video upload response");
        }

        const initStreamMediaId = initResponse.headers.get("stream-media-id") || initResponse.headers.get("Stream-Media-Id");
        let resolvedStreamId = initStreamMediaId ? initStreamMediaId.trim() : "";

        // Use XHR for the actual file upload to track progress
        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PATCH", uploadUrl);
            xhr.setRequestHeader("Tus-Resumable", "1.0.0");
            xhr.setRequestHeader("Upload-Offset", "0");
            xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");

            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        onProgress(event.loaded / event.total);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const uploadStreamId = xhr.getResponseHeader("stream-media-id") || xhr.getResponseHeader("Stream-Media-Id");
                    if (uploadStreamId) {
                        resolvedStreamId = uploadStreamId.trim();
                    }
                    resolve();
                } else {
                    reject(new Error(`Video upload failed: ${xhr.status} ${xhr.responseText}`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error during video upload"));

            // Send the blob directly
            xhr.send(blob);
        });

        if (!resolvedStreamId) {
            const parts = uploadUrl.split("/");
            resolvedStreamId = parts[parts.length - 1] || "";
        }

        if (!resolvedStreamId) {
            throw new Error("Unable to determine Stream-Media-Id after upload");
        }

        // Poll for video status
        await pollVideoStatus(resolvedStreamId);

        return `https://iframe.videodelivery.net/${resolvedStreamId}`;

    } catch (error) {
        console.error("[MediaService] Video upload error:", error);
        throw error;
    }
};

const GET_VIDEO_STATUS_ENDPOINT = "https://node.deso.org/api/v0/get-video-status";

const pollVideoStatus = async (videoId: string, maxAttempts = 20, interval = 2000): Promise<void> => {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${GET_VIDEO_STATUS_ENDPOINT}/${videoId}`);
            if (!response.ok) {
                console.warn(`[MediaService] Video status check failed: ${response.status}`);
                // Continue polling despite error, might be temporary
            } else {
                const data = await response.json();
                if (data.ReadyToStream) {
                    return;
                }
            }
        } catch (e) {
            console.warn("[MediaService] Error polling video status:", e);
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    console.warn("[MediaService] Video polling timed out, proceeding anyway.");
};
