export default function RetailerLoading() {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header placeholder */}
      <div className="h-14 bg-gradient-to-r from-pink-600 to-red-500" />

      <main className="container mx-auto px-4 py-5">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-40 bg-gray-200 rounded mb-4 animate-pulse" />

        {/* Header card skeleton */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-200" />
            <div className="space-y-2.5">
              <div className="h-7 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>

        {/* Filter bar skeleton */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 animate-pulse">
          <div className="flex gap-3">
            <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
            <div className="w-32 h-10 bg-gray-100 rounded-lg" />
          </div>
          <div className="flex gap-2 mt-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-7 w-16 bg-gray-100 rounded-full" />
            ))}
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-44 sm:h-52 bg-gray-100" />
              <div className="p-3.5 space-y-2">
                <div className="h-2.5 w-12 bg-gray-200 rounded" />
                <div className="h-3.5 w-full bg-gray-200 rounded" />
                <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
                <div className="h-5 w-20 bg-gray-200 rounded mt-3" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
