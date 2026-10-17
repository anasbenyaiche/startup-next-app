import { LoadingRegion, SKELETON_WIDTHS, Skeleton } from "@/app/components/Skeleton";
import { getDictionary } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

// Affiché par Next pendant la navigation vers la carte : la mise en page
// (panneau et carte) est déjà en place quand le vrai contenu arrive.
export default async function Loading() {
  const t = getDictionary(await getLocale());
  return (
    <LoadingRegion label={t.map.connecting} className="flex flex-col md:flex-row h-[calc(100dvh-3.5rem)]">
      <div className="md:w-[23rem] w-full md:h-full max-h-[52vh] md:max-h-none overflow-hidden border-b-[1.5px] md:border-b-0 md:border-e-[1.5px] border-encre bg-papier p-5 space-y-5">
        <div className="space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-wrap gap-1.5">
          {["w-48", "w-32", "w-28", "w-36", "w-40", "w-28"].map((w, i) => (
            <Skeleton key={i} className={`h-7 rounded-full ${w}`} />
          ))}
        </div>
        <div className="space-y-2 border-t-[1.5px] border-encre/20 pt-4">
          {SKELETON_WIDTHS.slice(0, 6).map((w, i) => (
            <Skeleton key={i} className="h-4" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-[48vh] bg-papier-fonce" />
    </LoadingRegion>
  );
}
