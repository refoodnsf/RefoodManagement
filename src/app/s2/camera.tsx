"use client";

import { useEffect, useRef, useState } from "react";
import { captureFrame } from "@/lib/image-client";
import { BackButton, Bi, CheckIcon, Countdown } from "../s1/ui";

type State = "starting" | "camara" | "previsualizacao" | "aCarregar" | "carregado" | "falhou" | "indisponivel";

/** 2.9 Carregar foto: take a photo with the Surface camera, preview, then use or retake. */
export default function Camera({ onBack, upload }: { onBack: () => void; upload: (b: Blob) => Promise<boolean> }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>("starting");
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera api");
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setState("camara");
      } catch {
        if (!cancelled) setState("indisponivel");
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  const take = async () => {
    if (!video.current || !video.current.videoWidth) return;
    const blob = await captureFrame(video.current);
    setShot({ blob, url: URL.createObjectURL(blob) });
    setState("previsualizacao");
  };

  const use = async () => {
    if (!shot) return;
    setState("aCarregar");
    setState((await upload(shot.blob)) ? "carregado" : "falhou");
  };

  const retake = () => {
    setShot(null);
    setState("camara");
  };

  const showShot = shot && (state === "previsualizacao" || state === "aCarregar" || state === "carregado" || state === "falhou");

  return (
    <div className="flex h-full flex-col gap-[24px] px-[48px] pb-[40px] pt-[32px]">
      <div className="flex items-center gap-[32px]">
        <BackButton onClick={onBack} />
        <Bi pt={<h1 className="text-[44px] font-black">Carregar fotos</h1>} en="Upload photos" enClass="text-[22px] text-muted" />
      </div>

      <div className="flex min-h-0 flex-1 gap-[32px]">
        <div className="relative flex w-[970px] shrink-0 items-center justify-center overflow-hidden rounded-[36px] bg-[#2a332c] text-[#dce3dd]">
          {/* Mirrored like a mirror while aiming; the saved photo is not mirrored. */}
          <video ref={video} muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
          {state === "starting" && <span className="relative text-[22px] font-bold">A ligar a câmara… · Starting camera…</span>}
          {state === "camara" &&
            ["left-[32px] top-[32px] border-l-[5px] border-t-[5px] rounded-tl-[14px]", "right-[32px] top-[32px] border-r-[5px] border-t-[5px] rounded-tr-[14px]", "left-[32px] bottom-[32px] border-l-[5px] border-b-[5px] rounded-bl-[14px]", "right-[32px] bottom-[32px] border-r-[5px] border-b-[5px] rounded-br-[14px]"].map((c) => (
              <span key={c} aria-hidden="true" className={`absolute h-[64px] w-[64px] border-white ${c}`} />
            ))}
          {showShot && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.url} alt="Foto tirada" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {state === "aCarregar" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[24px] bg-[rgba(31,42,34,.72)] text-white">
              <Bi pt="A carregar…" en="Uploading…" align="center" ptClass="text-[44px] font-black" enClass="text-[22px] text-leaf-mist" />
              <span className="block h-[24px] w-[480px] overflow-hidden rounded-[12px] bg-white/25">
                <span className="block h-full w-1/2 animate-pulse rounded-[12px] bg-white" />
              </span>
            </div>
          )}
          {state === "carregado" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[24px] bg-[rgba(251,248,242,.94)] text-ink">
              <span className="pop flex h-[160px] w-[160px] items-center justify-center rounded-full bg-leaf text-white shadow-[0_0_0_20px_#e4f1e8]">
                <CheckIcon size={96} />
              </span>
              <span className="mt-[12px]">
                <Bi pt="Foto adicionada!" en="Photo added!" align="center" ptClass="text-[56px] font-black" enClass="text-[26px] text-muted" />
              </span>
            </div>
          )}
          {state === "falhou" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[16px] bg-[rgba(251,248,242,.94)] text-ink">
              <Bi pt="Não foi possível enviar a foto" en="The photo could not be sent" align="center" ptClass="text-[44px] font-black" enClass="text-[24px] text-muted" />
              <Bi pt="Verifique a ligação e tente outra vez." en="Check the connection and try again." align="center" ptClass="text-[24px] font-bold" enClass="text-[18px] text-muted" />
            </div>
          )}
          {state === "indisponivel" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[20px] bg-sand text-ink">
              <Bi pt="Câmara indisponível" en="Camera unavailable" align="center" ptClass="text-[48px] font-black" enClass="text-[24px] text-muted" />
              <Bi pt="Avise um coordenador" en="Please tell a coordinator" align="center" ptClass="mt-[18px] text-[22px] font-bold" enClass="text-[17px] text-muted" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-[24px]">
          {state === "camara" && (
            <div className="flex flex-col items-center gap-[16px]">
              <button
                type="button"
                onClick={() => void take()}
                aria-label="Tirar foto / Take photo"
                className="tap flex h-[200px] w-[200px] items-center justify-center rounded-full border-[10px] border-leaf bg-white shadow-[0_0_0_8px_#e4f1e8]"
              >
                <span className="h-[130px] w-[130px] rounded-full bg-leaf" />
              </button>
              <Bi pt="Tirar foto" en="Take photo" align="center" ptClass="text-[28px] font-black" enClass="text-[17px] text-muted" />
            </div>
          )}
          {(state === "previsualizacao" || state === "falhou") && (
            <>
              <button
                type="button"
                onClick={() => void use()}
                className="tap flex h-[200px] flex-col items-center justify-center gap-[10px] rounded-[32px] bg-leaf text-white shadow-[0_6px_0_#1e5a38]"
              >
                <CheckIcon size={56} />
                <Bi pt={state === "falhou" ? "Tentar outra vez" : "Usar foto"} en={state === "falhou" ? "Try again" : "Use photo"} align="center" ptClass="text-[34px] font-black" enClass="text-[19px] text-leaf-mist" />
              </button>
              <button
                type="button"
                onClick={retake}
                className="tap flex h-[150px] flex-col items-center justify-center gap-[8px] rounded-[32px] border-[3px] border-line-strong bg-white text-ink"
              >
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <Bi pt="Repetir" en="Retake" align="center" ptClass="text-[30px] font-black" enClass="text-[17px] text-muted" />
              </button>
            </>
          )}
          {state === "carregado" && (
            <Bi pt="A foto já aparece no painel. Fica 5 dias." en="It now shows on the dashboard for 5 days." align="center" ptClass="text-[24px] font-extrabold" enClass="text-[17px] text-muted" />
          )}
        </div>
      </div>
      {state === "carregado" && <Countdown seconds={3} onDone={onBack} />}
    </div>
  );
}
