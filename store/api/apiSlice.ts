// RTK Query API slice for future API integrations
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Destination } from '../../types';

// Base API slice for future integrations
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      // Add any default headers here
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['Destination', 'MetroStation', 'Route'],
  endpoints: (builder) => ({
    // Placeholder endpoints for future API integrations
    
    // Google Places API integration (future)
    searchPlaces: builder.query<any[], string>({
      // This will be implemented when Google Places integration is added
      queryFn: () => ({ data: [] }), // Placeholder implementation
    }),

    // Delhi Metro API integration (future - Phase 2)
    getMetroStations: builder.query<any[], void>({
      providesTags: ['MetroStation'],
      // This will be implemented when Metro integration is added
      queryFn: () => ({ data: [] }), // Placeholder implementation
    }),

    getMetroRoute: builder.query<any, { from: string; to: string }>({
      providesTags: ['Route'],
      // This will be implemented when Metro integration is added
      queryFn: () => ({ data: null }), // Placeholder implementation
    }),

    // Sync saved destinations to cloud (future)
    syncDestinations: builder.mutation<void, Destination[]>({
      invalidatesTags: ['Destination'],
      // This will be implemented when cloud sync is added
      queryFn: () => ({ data: undefined }), // Placeholder implementation
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useSearchPlacesQuery,
  useGetMetroStationsQuery,
  useGetMetroRouteQuery,
  useSyncDestinationsMutation,
} = apiSlice;