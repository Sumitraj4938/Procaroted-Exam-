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

export async function POST(req: NextRequest) {
  try {
    const { image, image2 } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Capture base64 from data URL or remote HTTP/HTTPS URL
    const base64Data = await getBase64FromInput(image);
    const base64Data2 = image2 ? await getBase64FromInput(image2) : null;

    // Prepare contents with either one or two images
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
        "The second image (if provided) represents a secondary/side-angle environment camera (Secondary Cam) viewing the student and their desk/hands. " +
        "Provide a comprehensive proctor analysis and adhere strictly to these critical requirements:\n\n" +
        "1. STUDENT RECOGNITION: Confirm if the student's face is clearly visible, well-lit, and recognizable, and check for student identity consistency.\n" +
        "   - FACE IN DARK / NOT CLEARLY SEEN: If the student's face is in deep shadow, too dark to be distinguished, blurry, covered, or not visible in Camera 1, or if Camera 1 is completely black, blank, or covered, you MUST set faces_detected to 0 and student_recognized to false.\n" +
        "   - MULTIPLE FACES DETECTED: If there is more than one face visible in the frame (e.g., background people or someone sitting next to the student), you MUST count all of them. Set faces_detected to 2 or more, and set student_recognized to false.\n" +
        "2. DESK OBJECTS: Identify and list all visible objects on the desk/workspace (such as pen, paper, notebook, calculator, phone, bottle, secondary monitor).\n" +
        "3. HAND OBJECTS: Identify and list any objects currently in the student's hands in real-time.\n" +
        "4. ALERTS: Generate specific warning strings if unauthorized materials like smartphones, tablets, reference books, or cheat sheets are found on the desk, in hands, or within reach.\n" +
        "5. EXCESSIVE MOVEMENT: Detect any excessive physical body or rapid/repeated head/shoulder movements or extreme restlessness that could indicate cheating or looking at external aids."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faces_detected: { type: Type.INTEGER, description: "Number of full or partial faces detected" },
            head_movement: { type: Type.STRING, description: "One of: normal, looking_left, looking_right, looking_up, looking_down" },
            eye_gaze: { type: Type.STRING, description: "One of: center, left, right" },
            student_recognized: { type: Type.BOOLEAN, description: "True if the student is verified and recognized, false if identity mismatch or face missing" },
            excessive_movement: { type: Type.BOOLEAN, description: "True if the student is showing excessive, suspicious, or rapid body/head/shoulder movement, shifting excessively, or moving constantly in an unauthorized manner" },
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

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Proctoring API error:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze frame" }, { status: 500 });
  }
}
