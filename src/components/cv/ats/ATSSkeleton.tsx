import { Skeleton } from "@/components/ui/skeleton";

/** Squelette du rapport ATS : reprend la mise en page de `ATSResultsView`. */
export function ATSSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <Skeleton className="size-[168px] shrink-0 rounded-full" />
          <div className="flex w-full flex-col gap-3">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-7 w-44 rounded-md" />
            <Skeleton className="h-3.5 w-full rounded-md" />
            <Skeleton className="h-3.5 w-2/3 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-32 rounded-md" />
        <div className="flex flex-wrap gap-1.5">
          {[72, 96, 60, 84, 110, 68, 90, 76, 100, 64].map((w, i) => (
            <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
          ))}
        </div>
      </div>
    </div>
  );
}
