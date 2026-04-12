import {
  Camera,
  CircleLayer,
  MapView,
  setAccessToken,
  ShapeSource,
  SymbolLayer,
  UserLocation,
  type CameraRef,
  type MapViewRef,
  type OnPressEvent,
} from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  apiClient,
  borderRadius,
  BusinessListItemDto,
  colors,
  PaginatedResponseDto,
  RatingBadge,
  shadow,
  spacing,
  typography,
} from '@mettig/shared';
// MapLibre doesn't require an access token for OSM tiles
void setAccessToken(null);

// MapScreen устарел — карта встроена в HomeScreen. Файл оставлен для истории.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = { navigation: any };

// Free MapLibre demo style using OpenStreetMap tiles
const OSM_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

// Center of Grozny, Chechnya
const GROZNY_LNG = 45.6845;
const GROZNY_LAT = 43.3169;
const GROZNY_COORDS: GeoJSON.Position = [GROZNY_LNG, GROZNY_LAT];
const DEFAULT_ZOOM = 13;

function buildGeoJSON(
  businesses: BusinessListItemDto[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: businesses
      .filter((b) => b.lat != null && b.lng != null)
      .map((b) => ({
        type: 'Feature' as const,
        id: b.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [b.lng as number, b.lat as number],
        },
        properties: {
          id: b.id,
          name: b.name,
          category_icon: b.category_icon,
          category_name_ru: b.category_name_ru,
          avg_rating: b.avg_rating,
          review_count: b.review_count,
          photo: b.photos[0] ?? null,
          address: b.address,
        },
      })),
  };
}

export function MapScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  const [businesses, setBusinesses] = useState<BusinessListItemDto[]>([]);
  const [geoJSON, setGeoJSON] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    buildGeoJSON([]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<GeoJSON.Position | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessListItemDto | null>(null);

  useEffect(() => {
    void initMap();
  }, []);

  async function initMap(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    let lat = GROZNY_LAT;
    let lng = GROZNY_LNG;

    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      lat = loc.coords.latitude;
      lng = loc.coords.longitude;
      const coords: GeoJSON.Position = [lng, lat];
      setUserLocation(coords);
      cameraRef.current?.flyTo(coords, 600);
    }

    await fetchBusinesses(lat, lng);
  }

  const fetchBusinesses = useCallback(async (lat: number, lng: number): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<PaginatedResponseDto<BusinessListItemDto>>(
        '/businesses',
        { params: { lat, lng, limit: 200, page: 1 } },
      );
      const data = res.data.data;
      setBusinesses(data);
      setGeoJSON(buildGeoJSON(data));
    } catch {
      // Map still renders without businesses
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleShapePress = useCallback(
    async (event: OnPressEvent) => {
      const feature = event.features[0];
      if (!feature?.properties) return;

      const props = feature.properties as Record<string, unknown>;

      // Cluster tap → zoom in
      if (props['cluster'] === true) {
        const coords = (feature.geometry as GeoJSON.Point).coordinates;
        const currentZoom = (await mapRef.current?.getZoom()) ?? DEFAULT_ZOOM;
        cameraRef.current?.setCamera({
          centerCoordinate: coords,
          zoomLevel: currentZoom + 2,
          animationDuration: 400,
        });
        return;
      }

      // Individual marker tap → show mini-card
      const id = props['id'] as string;
      const business = businesses.find((b) => b.id === id);
      if (business) {
        setSelectedBusiness(business);
      }
    },
    [businesses],
  );

  const handleNavigate = useCallback(
    (businessId: string) => {
      setSelectedBusiness(null);
      navigation.navigate('Home', {
        screen: 'BusinessDetails',
        params: { businessId },
      });
    },
    [navigation],
  );

  const handleCenterUser = useCallback(() => {
    if (userLocation) {
      cameraRef.current?.flyTo(userLocation, 600);
    }
  }, [userLocation]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapStyle={OSM_STYLE_URL}
        logoEnabled={false}
        attributionEnabled={false}
        onPress={() => setSelectedBusiness(null)}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: GROZNY_COORDS,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        {userLocation != null && <UserLocation visible />}

        <ShapeSource
          id="businesses"
          shape={geoJSON}
          cluster
          clusterRadius={50}
          clusterMaxZoomLevel={14}
          onPress={handleShapePress}
        >
          {/* Cluster background circle */}
          <CircleLayer
            id="clusters"
            filter={['has', 'point_count']}
            style={{
              circleColor: colors.accent,
              circleRadius: [
                'step',
                ['get', 'point_count'],
                18, 10,
                22, 50,
                26,
              ],
              circleOpacity: 0.9,
            }}
          />

          {/* Cluster count label */}
          <SymbolLayer
            id="cluster-count"
            filter={['has', 'point_count']}
            style={{
              textField: '{point_count_abbreviated}',
              textSize: 13,
              textColor: colors.white,
              textIgnorePlacement: true,
              textAllowOverlap: true,
            }}
          />

          {/* Individual marker circle */}
          <CircleLayer
            id="unclustered-point"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleColor: colors.accent,
              circleRadius: 14,
              circleStrokeWidth: 2,
              circleStrokeColor: colors.white,
            }}
          />

          {/* Individual marker emoji icon */}
          <SymbolLayer
            id="unclustered-icon"
            filter={['!', ['has', 'point_count']]}
            style={{
              textField: '{category_icon}',
              textSize: 14,
              textIgnorePlacement: true,
              textAllowOverlap: true,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Loading indicator */}
      {isLoading && (
        <View style={[styles.loadingBadge, { top: insets.top + 12 }]}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      )}

      {/* My location button */}
      {userLocation != null && (
        <TouchableOpacity
          style={[styles.locationBtn, { bottom: insets.bottom + 24 }]}
          onPress={handleCenterUser}
          activeOpacity={0.8}
          accessibilityLabel="Моё местоположение"
        >
          <Text style={styles.locationBtnIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Mini-card */}
      {selectedBusiness != null && (
        <View style={[styles.miniCardWrapper, { bottom: insets.bottom + 80 }]}>
          <Pressable
            style={styles.miniCard}
            onPress={() => handleNavigate(selectedBusiness.id)}
            accessibilityRole="button"
            accessibilityLabel={`Открыть ${selectedBusiness.name}`}
          >
            {selectedBusiness.photos[0] != null ? (
              <Image
                source={{ uri: selectedBusiness.photos[0] }}
                style={styles.miniCardPhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.miniCardPhoto, styles.miniCardPhotoPlaceholder]}>
                <Text style={styles.miniCardEmoji}>{selectedBusiness.category_icon}</Text>
              </View>
            )}

            <View style={styles.miniCardBody}>
              <Text style={styles.miniCardName} numberOfLines={1}>
                {selectedBusiness.name}
              </Text>
              <Text style={styles.miniCardCategory} numberOfLines={1}>
                {selectedBusiness.category_name_ru}
              </Text>
              {selectedBusiness.avg_rating != null && (
                <View style={styles.miniCardRatingRow}>
                  <RatingBadge rating={selectedBusiness.avg_rating} />
                  <Text style={styles.miniCardReviews}>
                    {selectedBusiness.review_count} отзывов
                  </Text>
                </View>
              )}
              <Text style={styles.miniCardAddress} numberOfLines={1}>
                {selectedBusiness.address}
              </Text>
            </View>

            <Text style={styles.miniCardChevron}>›</Text>
          </Pressable>

          <TouchableOpacity
            style={styles.miniCardCloseBtn}
            onPress={() => setSelectedBusiness(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Закрыть"
          >
            <Text style={styles.miniCardCloseIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingBadge: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  locationBtn: {
    position: 'absolute',
    right: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  locationBtnIcon: {
    fontSize: 22,
  },
  miniCardWrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  miniCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    ...shadow.md,
  },
  miniCardPhoto: {
    width: 72,
    height: 80,
  },
  miniCardPhotoPlaceholder: {
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardEmoji: {
    fontSize: 28,
  },
  miniCardBody: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  miniCardName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  miniCardCategory: {
    ...typography.caption,
    color: colors.textMuted,
  },
  miniCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  miniCardReviews: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  miniCardAddress: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  miniCardChevron: {
    fontSize: 24,
    color: colors.textMuted,
    paddingRight: spacing.md,
  },
  miniCardCloseBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  miniCardCloseIcon: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
