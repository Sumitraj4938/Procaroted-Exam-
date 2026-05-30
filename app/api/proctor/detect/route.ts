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

export async function POST(req: NextRequest) {
  try {
    const { image, image2 } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Extract base64 part support data url formats
    const base64Data = image.includes(",") ? image.split(",")[1] : image;
    const base64Data2 = image2 ? (image2.includes(",") ? image2.split(",")[1] : image2) : null;

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

    // Call the AI model
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        ...contents,
        "Analyze these two webcam frames captured simultaneously during an online proctored exam. " +
        "The first image represents the student's frontal/face camera (Primary Cam), which should focus on the student's face. " +
        "The second image (if provided) represents a secondary/side-angle environment camera (Secondary Cam) to detect blind spots, unauthorized materials, screens, or secondary devices. " +
        "Ensure there is exactly one student in the first image, and no other human presence. For the second image, verify that there are no additional screens, smartphones, books, papers, or cheat sheets. " +
        "Output a JSON object with strictly these keys: 'faces_detected' (number, representing total face elements found), 'head_movement' (string: 'normal', 'looking_left', 'looking_right', 'looking_up', 'looking_down' based on the Primary Cam), 'eye_gaze' (string: 'center', 'left', 'right'), 'warnings' (array of strings explaining any violations found, e.g. 'No face detected in primary camera', 'Multiple faces detected', 'Unpermitted mobile phone or accessory in secondary view', 'Head turned right', 'Looking away from screen')."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faces_detected: { type: Type.INTEGER, description: "Number of full or partial faces detected" },
            head_movement: { type: Type.STRING, description: "One of: normal, looking_left, looking_right, looking_up, looking_down" },
            eye_gaze: { type: Type.STRING, description: "One of: center, left, right" },
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of violation warning descriptions"
            }
          },
          required: ["faces_detected", "head_movement", "eye_gaze", "warnings"]
        }
      }
    });

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Proctoring API error:", error);
    return NextResponse.json({ error: error.message || "Failed to analyze frame" }, { status: 500 });
  }
}
