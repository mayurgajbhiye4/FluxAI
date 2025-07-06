import { toast } from "@/components/ui/use-toast";

export function handle429(response: Response) {
  let retryAfter = response.headers.get("Retry-After");
  let waitMsg = "";
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      if (seconds < 60) {
        waitMsg = `${seconds} seconds`;
      } else {
        waitMsg = `${Math.ceil(seconds / 60)} minutes`;
      }
    }
  }
  toast({
    title: "AI limit reached",
    description: waitMsg
      ? `Please try again after ${waitMsg}.`
      : "Please try again later.",
    variant: "destructive",
  });
}