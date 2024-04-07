import { MicVAD } from "@ricky0123/vad-web";
import { useState, useRef } from "react";

interface VADProps {
  stream: MediaStream | undefined;
  recording: boolean;
}

interface TranscriptionResult {
  status: string;
  text: string;
}

const SpeechProcessing = (props: VADProps) => {
  const vad = useRef<MicVAD>();
  const vadLock = useRef<boolean>();
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [detectorState, setDetectorState] = useState("waiting");

  const updateTexts = (result: TranscriptionResult) => {
    const newText = result.status == "success" ? result.text : "Nepodarilo se";
    const newTexts = [newText];
    setTranscriptions(newTexts);
    setDetectorState("waiting");
  };

  async function sendSpeechToBackend(audio: Float32Array) {
    const base64url: Blob = await new Promise((r) => {
      const reader = new FileReader();
      reader.onload = () => r(reader.result);
      reader.readAsDataURL(new Blob([audio]));
    });

    const base64 = base64url.slice(base64url.indexOf(",") + 1);

    console.log("sending data for analysis ...");
    setDetectorState("transcription");

    const response = await fetch("http://localhost:8080/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio: base64 }),
    });

    const result = await response.json();

    console.log(result);
    return result;
  }

  if (props.recording) {
    if (props.stream) {
      if (!vadLock.current) {
        vadLock.current = true;

        if (!vad.current) {
          MicVAD.new({
            stream: props.stream,
            onSpeechStart: () => {
              console.log("speech start detected ...");
              setDetectorState("in speech");
            },
            onSpeechEnd: (audio) => {
              console.log(`speech done with ${audio.length} samples`);
              sendSpeechToBackend(audio).then((newText) =>
                updateTexts(newText)
              );
            },
            onVADMisfire: () => {
              console.log("speech was too short, misfire");
            },
          }).then((newVAD: MicVAD) => {
            newVAD.start();
            console.log("vad started ...");
            vad.current = newVAD;
            vadLock.current = false;
          });
        }
      }
    } else {
      if (vad.current) {
        vad.current.destroy();
        vad.current = undefined;
      }
    }
  }

  return (
    <div>
      <p> {detectorState} </p>
      <ul>
        {transcriptions.map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
    </div>
  );
};

export default SpeechProcessing;