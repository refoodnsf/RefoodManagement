import { Bi } from "../s1/ui";

export type EventSlide = { title: string; body: string; image: string | null; qrSvg: string | null };

/** 2.10 Cartão de evento (804×480), shown in the photo panel and as the System 3 preview. */
export default function EventCard({ slide }: { slide: EventSlide }) {
  const withImage = !!slide.image;
  return (
    <div className={`flex h-full w-full overflow-hidden rounded-[36px] ${withImage ? "border-2 border-line bg-white" : "bg-peach"}`}>
      {withImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.image!} alt="" className="h-full w-[380px] shrink-0 object-cover" draggable={false} />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-[14px] px-[36px] py-[32px]">
        <span className="self-start rounded-[10px] bg-orange px-[14px] py-[6px] text-[16px] font-black tracking-[.5px] text-ink">EVENTO</span>
        <span className={withImage ? "text-[36px] font-black leading-[1.12]" : "text-[52px] font-black leading-[1.08]"}>{slide.title}</span>
        <span className={withImage ? "text-[21px] font-semibold leading-[1.35] text-quiet" : "text-[26px] font-semibold leading-[1.35] text-[#3f2a16]"}>{slide.body}</span>
        {slide.qrSvg && (
          <div className="mt-auto flex items-center gap-[18px]">
            <span role="img" aria-label="Código QR" className="qr block h-[120px] w-[120px] shrink-0 rounded-[14px] border-2 border-line bg-white p-[8px]" dangerouslySetInnerHTML={{ __html: slide.qrSvg }} />
            <Bi pt="Lê o código" en="Scan me" ptClass="text-[30px] font-black" enClass="text-[17px] text-muted" />
          </div>
        )}
      </div>
    </div>
  );
}
