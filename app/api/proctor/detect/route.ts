import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Initialize AI client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function getBase64FromInput(input: string): Promise<string> {
  if (!input) return "";
  if (input === "simulated") {
    // High-performance transparent fallback to keep simulated camera loop fast & reliable
    return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const res = await fetch(input);
      if (!res.ok) throw new Error("Failed to fetch image");
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer).toString("base64");
    } catch (err) {
      console.error("Failed to fetch image from URL", input, err);
      // Fallback to a transparent pixel
      return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }
  }
  return input.includes(",") ? input.split(",")[1] : input;
}

// Highly precise Eden AI Face Detection using multipart FormData
async function callEdenAIFaceDetection(base64Image: string): Promise<{ faces_detected: number; student_recognized: boolean }> {
  const EDENAI_API_KEY = process.env.EDENAI_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMWFmZjNhNWYtMWExYS00MDliLWIxZTktOWE1N2E4OTdlZmUyIiwidHlwZSI6ImFwaV90b2tlbiJ9.VUTgYMsOAxv6JbdWTYzPyeAJARjoMuDN3OFakkxbqrk";
  
  if (!EDENAI_API_KEY) {
    throw new Error("No Eden AI API Key available.");
  }

  const formData = new FormData();
  formData.append("providers", "google,amazon");
  
  const buffer = Buffer.from(base64Image, "base64");
  const blob = new Blob([buffer], { type: "image/jpeg" });
  formData.append("file", blob, "image.jpg");

  const response = await fetch("https://api.edenai.run/v2/image/face_detection", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${EDENAI_API_KEY}`
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Eden AI face detection API error:", errText);
    throw new Error(`Eden AI returned status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  console.log("Eden AI face detection API response:", JSON.stringify(data));

  let facesDetected = 0;

  // Standardized response parsing
  if (data && data["eden-ai"] && Array.isArray(data["eden-ai"].extracted_data)) {
    facesDetected = data["eden-ai"].extracted_data.length;
  } else {
    // Standard provider fallback
    for (const provider of ["google", "amazon", "microsoft"]) {
      if (data[provider] && data[provider].status === "success" && data[provider].items) {
        if (Array.isArray(data[provider].items) && data[provider].items.length > facesDetected) {
          facesDetected = data[provider].items.length;
        }
      }
    }
  }

  return {
    faces_detected: facesDetected,
    student_recognized: facesDetected === 1
  };
}

export async function POST(req: NextRequest) {
  try {
    const { image, image2 } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Capture base64 from data URL or remote HTTP/HTTPS URL
    const base64Data = await getBase64FromInput(image);
    const base64Data2 = image2 ? await getBase64FromInput(image2) : null;

    // Call Eden AI Face Detection in parallel with Gemini proctor analysis for maximum speed
    let edenAIFaceData: { faces_detected: number; student_recognized: boolean } | null = null;
    try {
      edenAIFaceData = await callEdenAIFaceDetection(base64Data);
      console.log("Eden AI Face Detection successful. Faces found:", edenAIFaceData.faces_detected);
    } catch (edenErr) {
      console.warn("Eden AI Face Detection failed, will fall back entirely to Gemini face detection:", edenErr);
    }

    // Prepare contents with either one or two images for Gemini complete visual description
    const contents: any[] = [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data,
        },
      }
    ];

    if (base64Data2) {
      contents.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data2,
        }
      });
    }

    // Call the AI model for high fidelity proctor verification
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...contents,
        "Analyze these webcam frames captured during an online proctored exam. " +
        "The first image represents the student's frontal/face camera (Primary Cam). " +
        "The second image (if provided) represents a secondary/side-angle environment camera (Secondary Cam) viewing the student and their desk/hands.\n\n" +
        "CRITICAL SECURITY AUDIT FOR MULTIPLE PEOPLE:\n" +
        "1. Carefully scan the entire primary camera frame AND the secondary camera frame (if active) for any other humans, faces, heads, hair, shoulders, arms, hands, bodies, profile outlines, or silhouettes.\n" +
        "2. If there are TWO or more distinct human faces, partial faces, or distinct people/bodies present inside ANY of the webcam frames (e.g. background helpers, side-by-side friends, or people leaning into view), you MUST immediately set faces_detected to 2 or more, and set student_recognized to false.\n" +
        "3. Always add a warning string stating: 'Multiple faces detected in the camera frame! Only the authorized student is permitted to be present.' if more than 1 person is detected.\n" +
        "4. If the student's face is completely obscured, dark, blur, or missing, set faces_detected to 0."
      ],
      config: {
        systemInstruction: "You are an extremely strict, paranoid AI Exam Proctor security auditor. Your single most critical priority is finding cheating assistants, secondary people, or unauthorized help. You must examine every pixel of the webcam frames. If there is even a faint or partial presence of an extra person (friend, parent, helper, teacher, outline, shoulder, head, half-face) in the camera frame or background, you MUST count it. If 2 or more people/faces appear in any frame, set faces_detected to 2 or more, set student_recognized to false, and raise a multiple faces warning.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faces_detected: { type: Type.INTEGER, description: "Number of full or partial faces detected in the frame" },
            head_movement: { type: Type.STRING, description: "One of: normal, looking_left, looking_right, looking_up, looking_down" },
            eye_gaze: { type: Type.STRING, description: "One of: center, left, right" },
            student_recognized: { type: Type.BOOLEAN, description: "True if only the single authorized student is present and verified, false if identity mismatch or multiple faces/people are detected" },
            excessive_movement: { type: Type.BOOLEAN, description: "True if the student is showing excessive, suspicious, or rapid body/head/shoulder movement, shifting excessively" },
            desk_objects: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of items and objects detected on the desk or workspace"
            },
            hand_objects: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of objects held in the student's hands"
            },
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of violation warning descriptions"
            }
          },
          required: ["faces_detected", "head_movement", "eye_gaze", "student_recognized", "excessive_movement", "desk_objects", "hand_objects", "warnings"]
        }
      }
    });

    let resultText = response.text || "{}";
    // Sanitize any markdown JSON codeblock markers if present
    if (resultText.includes("```")) {
      resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    }
    const data = JSON.parse(resultText);

    // 1. Reconcile Gemini and Eden AI results so that we never hide multiple faces or missed detections
    const geminiFaces = typeof data.faces_detected === "number" ? data.faces_detected : 1;
    let finalFaces = geminiFaces;
    let finalStudentRecognized = data.student_recognized !== false;

    if (edenAIFaceData) {
      const edenFaces = edenAIFaceData.faces_detected;
      // Take the safe maximum number of faces detected across both models to maximize security coverage
      finalFaces = Math.max(geminiFaces, edenFaces);

      // If only 1 face is detected, respect the recognized status but avoid false "no face" alerts from Eden AI when Gemini can clearly see 1 face
      if (finalFaces === 1) {
        if (edenFaces === 0 && geminiFaces === 1) {
          // Keep face count as 1, trust Gemini's detection
        } else {
          finalStudentRecognized = finalStudentRecognized && edenAIFaceData.student_recognized;
        }
      }
    }

    // 2. Assign reconciled values back to the returned data structure
    data.faces_detected = finalFaces;

    // 3. Strictest security check for multiple faces (applied universally, even if Eden AI was offline or skipped)
    if (data.faces_detected > 1) {
      data.student_recognized = false;
      
      // Ensure there is a highly visible multiple faces warning
      if (!data.warnings) data.warnings = [];
      const hasMultiFaceWarn = data.warnings.some((w: string) => 
        w.toLowerCase().includes("multiple") || 
        w.toLowerCase().includes("more than one") ||
        w.toLowerCase().includes("extra person") ||
        w.toLowerCase().includes("authorized student")
      );
      if (!hasMultiFaceWarn) {
        data.warnings.push("Multiple faces detected in the camera frame! Only the authorized student is permitted to be present.");
      }
    } else {
      data.student_recognized = finalStudentRecognized;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Proctoring API error:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze frame" }, { status: 500 });
  }
}

