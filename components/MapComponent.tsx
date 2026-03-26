// Map component wrapper for React Native Maps
import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Circle, LatLng, Marker, Region } from "react-native-maps";
import { useAppDispatch } from "../store/hooks";
import { setMapReady, setMapRegion } from "../store/slices/uiSlice";
import { Coordinate, Destination } from "../types";

interface MapComponentProps {
  currentLocation: Coordinate | null;
  selectedDestination: Destination | null;
  mapRegion: Region | null;
  onMapPress: (coordinate: LatLng) => void;
  onMapReady: () => void;
  shouldFitMarkers?: boolean;
  shouldCenterOnLocation?: boolean;
  triggerRadius?: number; // in metres
}

const MapComponent: React.FC<MapComponentProps> = ({
  currentLocation,
  selectedDestination,
  mapRegion,
  onMapPress,
  onMapReady,
  shouldFitMarkers = false,
  shouldCenterOnLocation = false,
  triggerRadius = 500,
}) => {
  const mapRef = useRef<MapView>(null);
  const dispatch = useAppDispatch();
  const hasFittedMarkers = useRef(false);
  const initialLocationSet = useRef(false);

  // Default region (Delhi, India) if no location is available
  const defaultRegion: Region = {
    latitude: 28.6139,
    longitude: 77.209,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  // Calculate initial region based on current location or use default
  const initialRegion: Region = currentLocation
    ? {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    }
    : mapRegion || defaultRegion;

  const handleMapPress = (event: { nativeEvent: { coordinate: LatLng } }) => {
    const { coordinate } = event.nativeEvent;
    onMapPress(coordinate);
  };

  const handleMapReady = () => {
    dispatch(setMapReady(true));
    onMapReady();
  };

  const handleRegionChangeComplete = (region: Region) => {
    dispatch(setMapRegion(region));
  };

  // Animate to current location when it becomes available (only on initial load)
  useEffect(() => {
    if (
      currentLocation &&
      mapRef.current &&
      !initialLocationSet.current &&
      !shouldFitMarkers
    ) {
      const region: Region = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      mapRef.current.animateToRegion(region, 1000);
      initialLocationSet.current = true;
    }
  }, [currentLocation, shouldFitMarkers]);

  // Re-centre on current location when locate button is pressed (no destination selected)
  useEffect(() => {
    if (shouldCenterOnLocation && currentLocation && mapRef.current) {
      const region: Region = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      mapRef.current.animateToRegion(region, 800);
    }
  }, [shouldCenterOnLocation]);

  // Fit both markers when destination is selected and shouldFitMarkers is true
  useEffect(() => {
    if (
      shouldFitMarkers &&
      currentLocation &&
      selectedDestination &&
      mapRef.current
    ) {
      const markers = [currentLocation, selectedDestination.coordinate];

      mapRef.current.fitToCoordinates(markers, {
        edgePadding: {
          top: 100,
          right: 50,
          bottom: 100,
          left: 50,
        },
        animated: true,
      });
      hasFittedMarkers.current = true;
    } else if (
      shouldFitMarkers &&
      selectedDestination &&
      mapRef.current &&
      !currentLocation
    ) {
      // If no current location, just center on destination
      const region: Region = {
        latitude: selectedDestination.coordinate.latitude,
        longitude: selectedDestination.coordinate.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      mapRef.current.animateToRegion(region, 1000);
      hasFittedMarkers.current = true;
    }
  }, [shouldFitMarkers, currentLocation, selectedDestination]);

  // Reset hasFittedMarkers when destination is cleared and zoom back to current location
  useEffect(() => {
    if (!selectedDestination) {
      hasFittedMarkers.current = false;
      // Zoom back to current location when destination is cleared
      if (currentLocation && mapRef.current) {
        const region: Region = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        mapRef.current.animateToRegion(region, 1000);
      }
    }
  }, [selectedDestination, currentLocation]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={initialRegion}
      onPress={handleMapPress}
      onMapReady={handleMapReady}
      onRegionChangeComplete={handleRegionChangeComplete}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={true}
      showsScale={true}
      mapType="standard"
      pitchEnabled={false}
      rotateEnabled={false}
      scrollEnabled={true}
      zoomEnabled={true}
    >
      {/* Current location marker (if available and different from user location dot) */}
      {currentLocation && (
        <Marker
          coordinate={currentLocation}
          title="Current Location"
          description="You are here"
          pinColor="blue"
          identifier="current-location"
        />
      )}

      {/* Selected destination marker + trigger-radius circle */}
      {selectedDestination && (
        <>
          <Marker
            coordinate={selectedDestination.coordinate}
            title={selectedDestination.name}
            description={selectedDestination.address || "Selected destination"}
            pinColor="red"
            identifier="selected-destination"
            anchor={{ x: 0.5, y: 0.5 }}
            calloutAnchor={{ x: 0.5, y: 0 }}
          />
          <Circle
            center={selectedDestination.coordinate}
            radius={triggerRadius}
            strokeWidth={2}
            strokeColor="rgba(240, 169, 166, 0.9)"
            fillColor="rgba(185, 34, 29, 0.15)"
          />
        </>
      )}
    </MapView>
  );
};

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});

export default MapComponent;
