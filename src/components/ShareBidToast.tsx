import { toast } from "sonner";
import { Mail, Linkedin } from "lucide-react";

const SITE_URL = "https://yourmessagehere.co";

function shareLinks(advertiser: string) {
  const text = `${advertiser || "I"} just bid on the internet's billboard. One brand, one week — highest bid wins.`;
  const url = SITE_URL;
  const e = encodeURIComponent;
  return {
    email: `mailto:?subject=${e("I just bid on the internet's billboard")}&body=${e(`${text}\n\n${url}`)}`,
    x: `https://x.com/intent/tweet?text=${e(text)}&url=${e(url)}`,
    reddit: `https://www.reddit.com/submit?url=${e(url)}&title=${e(text)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
  };
}

const item =
  "flex items-center gap-2 rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/5";

export function showShareBidToast(advertiser: string) {
  const links = shareLinks(advertiser);
  toast.custom(
    (id) => (
      <div className="w-[320px] rounded-lg border border-foreground/15 bg-background p-4 text-foreground shadow-lg">
        <p className="text-sm font-bold">Bid placed. Tell someone.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Share the billboard — more eyes means a better week for the winner.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className={item} href={links.x} target="_blank" rel="noopener noreferrer">
            <span aria-hidden>𝕏</span> X
          </a>
          <a className={item} href={links.reddit} target="_blank" rel="noopener noreferrer">
            <span aria-hidden>r/</span> Reddit
          </a>
          <a className={item} href={links.linkedin} target="_blank" rel="noopener noreferrer">
            <Linkedin className="size-3.5" aria-hidden /> LinkedIn
          </a>
          <a className={item} href={links.email}>
            <Mail className="size-3.5" aria-hidden /> Email
          </a>
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(id)}
          className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Dismiss
        </button>
      </div>
    ),
    { duration: 20000 },
  );
}
