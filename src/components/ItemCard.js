// src/components/ItemCard.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { COLORS } from '../constants/theme';

const { width: W } = Dimensions.get('window');
// 12px padding each side + 12px gap between columns
export const CARD_WIDTH = (W - 24 - 12) / 2;

// ── Shimmer skeleton shown while loading ─────────────────────────────────────
export function ItemCardSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={[styles.card, { width: CARD_WIDTH }]}>
      {/* image placeholder */}
      <Animated.View
        style={[styles.skeletonImage, { opacity: pulse }]}
      />
      <View style={styles.info}>
        {/* title lines */}
        <Animated.View style={[styles.skeletonLine, { width: '88%', opacity: pulse }]} />
        <Animated.View style={[styles.skeletonLine, { width: '60%', marginTop: 5, opacity: pulse }]} />
        {/* price line */}
        <Animated.View style={[styles.skeletonPrice, { opacity: pulse }]} />
      </View>
    </View>
  );
}

// ── Real item card ────────────────────────────────────────────────────────────
function ItemCard({ item, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();

  const handlePressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  const showVariantDots = item.variants && item.variants.length > 1;
  const displayPrice    = item.price === 0
    ? 'Price on request'
    : `₹${item.price.toLocaleString('en-IN')}`;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onPress(item)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.card, { width: CARD_WIDTH, transform: [{ scale: scaleAnim }] }]}>

        {/* ── Image ── */}
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: item.image_url }}
            style={styles.image}
            resizeMode="cover"
          />

          {/* Category pill — only if category exists */}
          {item.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {item.category}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Info ── */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>

          {/* Variant dots */}
          {showVariantDots && (
            <View style={styles.variantRow}>
              {item.variants.slice(0, 3).map((_, i) => (
                <View key={i} style={[styles.variantDot, { opacity: 1 - i * 0.25 }]} />
              ))}
              {item.variants.length > 3 && (
                <Text style={styles.variantMore}>+{item.variants.length - 3}</Text>
              )}
            </View>
          )}

          <Text style={styles.price}>{displayPrice}</Text>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

export default React.memo(ItemCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#1A1008',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Android shadow
    elevation: 3,
    marginBottom: 14,
  },

  // ── Image ──────────────────────────────────────────────────
  imageWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#F0EBE1',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  categoryPill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    maxWidth: CARD_WIDTH - 20,
  },
  categoryText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // ── Info ───────────────────────────────────────────────────
  info: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  variantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  variantMore: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: '600',
    marginLeft: 2,
  },
  price: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 7,
    letterSpacing: -0.2,
  },

  // ── Skeleton ───────────────────────────────────────────────
  skeletonImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#E8E0D5',
  },
  skeletonLine: {
    height: 11,
    borderRadius: 6,
    backgroundColor: '#E8E0D5',
    marginBottom: 2,
  },
  skeletonPrice: {
    height: 14,
    width: '50%',
    borderRadius: 6,
    backgroundColor: '#E8E0D5',
    marginTop: 8,
  },
});
