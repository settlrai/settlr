"use client";

import { PolygonWithMeta } from "@/types/map";

interface RegionDetailsPanelProps {
  selectedPolygon: PolygonWithMeta | undefined;
  isLoadingRegionDetails: boolean;
  regionFetchError: string | null;
  hoveredPOI: string | null;
  onHoverPOI: (poiId: string | null) => void;
  onBackToOverview: () => void;
}

export default function RegionDetailsPanel({
  selectedPolygon,
  isLoadingRegionDetails,
  regionFetchError,
  hoveredPOI,
  onHoverPOI,
  onBackToOverview,
}: RegionDetailsPanelProps) {
  if (!selectedPolygon) {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 h-full w-64 bg-white border-r border-gray-300 shadow-lg z-10 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onBackToOverview}
          className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to overview
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="w-full">
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            {selectedPolygon.region_name}
          </h3>

          {isLoadingRegionDetails && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading details...
            </div>
          )}

          {regionFetchError && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200 mb-4">
              {regionFetchError}
            </div>
          )}

          {selectedPolygon.points_of_interest &&
            selectedPolygon.points_of_interest.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-md font-medium text-gray-700 border-b border-gray-200 pb-2">
                  Points of Interest
                </h4>
                {selectedPolygon.points_of_interest.map((poiGroup) => (
                  <div key={poiGroup.id} className="space-y-3">
                    <h5 className="text-sm font-medium text-gray-600 capitalize">
                      {poiGroup.interest_type.replace(/_/g, " ")}
                    </h5>
                    <div className="space-y-2">
                      {poiGroup.points_of_interest.map((poi, index) => {
                        const poiId = `${poiGroup.id}-${index}`;
                        return (
                          <div
                            key={index}
                            className="bg-gray-50 rounded-lg p-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                            onMouseEnter={() => onHoverPOI(poiId)}
                            onMouseLeave={() => onHoverPOI(null)}
                          >
                            <div className="font-medium text-gray-800 mb-1">
                              {poi.name}
                            </div>
                            <div className="text-gray-600 text-xs mb-2">
                              {poi.address}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`w-3 h-3 ${
                                      i < Math.floor(poi.rating)
                                        ? "text-yellow-400"
                                        : "text-gray-300"
                                    }`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-xs text-gray-500">
                                {poi.rating.toFixed(1)} ({poi.review_count} reviews)
                              </span>
                            </div>
                            {poi.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {poi.categories
                                  .slice(0, 3)
                                  .map((category, catIndex) => (
                                    <span
                                      key={catIndex}
                                      className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                                    >
                                      {category}
                                    </span>
                                  ))}
                                {poi.categories.length > 3 && (
                                  <span className="text-xs text-gray-500">
                                    +{poi.categories.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}