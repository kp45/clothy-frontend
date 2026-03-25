// src/screens/ProductScreen.js
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, FlatList,
  TouchableOpacity, StyleSheet, Dimensions,
  Animated, StatusBar, Platform, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { COLORS, WHATSAPP_NUMBER } from '../constants/theme';
import { getItemByUniqueId, getAllItems } from '../api/services';

const { width: W } = Dimensions.get('window');
const IMG_H  = W * 1.15;
const CARD_W = (W - 24 - 12) / 2;
const CALL_NUMBER = '+917383160724';
const FALLBACK_WHATSAPP_NUMBER = '917383160724';

// ─────────────────────────────────────────────────────────────────────────────
// Image Gallery
// ─────────────────────────────────────────────────────────────────────────────
function ImageGallery({ images, onBack }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setActiveIndex(0);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 340, useNativeDriver: true }).start();
  }, [images]);

  const handleScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setActiveIndex(idx);
  };

  // Single image — just render it, no scroll needed
  if (!images || images.length === 0) {
    return (
      <View style={styles.galleryWrap}>
        <View style={[styles.gallerySlide, { backgroundColor: '#F0EBE1' }]} />
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.galleryWrap, { opacity: fadeAnim }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {images.map((uri, i) => (
          <View key={i} style={styles.gallerySlide}>
            <Image source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
            <View style={styles.galleryScrim} />
          </View>
        ))}
      </ScrollView>

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={styles.backChevron}>‹</Text>
      </TouchableOpacity>

      {/* Counter */}
      {images.length > 1 && (
        <View style={styles.imgCounter}>
          <Text style={styles.imgCounterText}>
            {String(activeIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
          </Text>
        </View>
      )}

      {/* Dots */}
      {images.length > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Size selector
// ─────────────────────────────────────────────────────────────────────────────
function SizeSelector({ sizes }) {
  const [selected, setSelected] = useState(sizes?.[0] ?? null);
  useEffect(() => { setSelected(sizes?.[0] ?? null); }, [sizes]);

  if (!sizes || sizes.length === 0) return null;

  return (
    <View style={styles.sizeRow}>
      {sizes.map((s) => (
        <TouchableOpacity
          key={s}
          style={[styles.sizeBtn, selected === s && styles.sizeBtnActive]}
          onPress={() => setSelected(s)}
          activeOpacity={0.75}
        >
          <Text style={[styles.sizeTxt, selected === s && styles.sizeTxtActive]}>{s}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant strip — uses the item's variants array (list of image URLs)
// ─────────────────────────────────────────────────────────────────────────────
function VariantStrip({ variants, mainImage }) {
  // variants is a list of image URLs from the DB
  // Show up to 3, skip the main image to avoid duplicate
  if (!variants || variants.length <= 1) return null;

  const displayVariants = variants.filter((v) => v !== mainImage).slice(0, 3);
  if (displayVariants.length === 0) return null;

  return (
    <View style={styles.variantSection}>
      <View style={styles.variantHeader}>
        <View style={styles.accentBar} />
        <Text style={styles.variantLabel}>More Views</Text>
      </View>
      <View style={styles.variantRow}>
        {displayVariants.map((url, i) => (
          <View key={i} style={styles.variantCard}>
            <Image source={{ uri: url }} style={styles.variantImg} resizeMode="cover" />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching items strip — uses related item unique IDs configured per product
// ─────────────────────────────────────────────────────────────────────────────
function MatchingStrip({ entries, onPress }) {
  if (!entries || entries.length === 0) return null;

  return (
    <View style={styles.matchSection}>
      <View style={styles.variantHeader}>
        <View style={styles.accentBar} />
        <Text style={styles.variantLabel}>Matching Styles</Text>
      </View>
      <Text style={styles.matchSub}>Three linked looks picked for this piece.</Text>
      <View style={styles.matchRow}>
        {entries.map((entry, index) => (
          <TouchableOpacity
            key={`${entry.unique_id}-${index}`}
            style={styles.matchCard}
            onPress={() => onPress(entry.unique_id)}
            activeOpacity={0.86}
          >
            {entry.image_url ? (
              <Image source={{ uri: entry.image_url }} style={styles.matchImg} resizeMode="cover" />
            ) : (
              <View style={[styles.matchImg, styles.matchPlaceholder]}>
                <Text style={styles.matchPlaceholderTxt}>No Preview</Text>
              </View>
            )}
            <Text style={styles.matchTitle} numberOfLines={2}>
              {entry.title || entry.unique_id}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Similar item card
// ─────────────────────────────────────────────────────────────────────────────
function SimilarCard({ item, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20 }).start();

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => onPress(item.unique_id)} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[styles.simCard, { width: CARD_W, transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.simImgWrap}>
          <Image source={{ uri: item.image_url }} style={styles.simImg} resizeMode="cover" />
          {item.category ? (
            <View style={styles.simPill}>
              <Text style={styles.simPillTxt}>{item.category}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.simInfo}>
          <Text style={styles.simTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.simPrice}>
            {item.price === 0 ? 'Price on request' : `₹${item.price.toLocaleString('en-IN')}`}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-screen loading state
// ─────────────────────────────────────────────────────────────────────────────
function ProductSkeleton({ onBack }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#FAF7F2' }}>
      <Animated.View style={[styles.galleryWrap, { opacity: pulse, backgroundColor: '#D8CFC0' }]} />
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={styles.backChevron}>‹</Text>
      </TouchableOpacity>
      <View style={{ padding: 20, gap: 12 }}>
        <Animated.View style={[styles.skelLine, { width: '40%', height: 12, opacity: pulse }]} />
        <Animated.View style={[styles.skelLine, { width: '80%', height: 22, opacity: pulse }]} />
        <Animated.View style={[styles.skelLine, { width: '30%', height: 20, opacity: pulse }]} />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductScreen({ route, navigation }) {
  const initialId = String(route.params?.uniqueId ?? '');
  const [currentId, setCurrentId]     = useState(initialId);
  const [product,   setProduct]       = useState(null);
  const [similar,   setSimilar]       = useState([]);
  const [loading,   setLoading]       = useState(true);
  const [error,     setError]         = useState(null);
  const listRef    = useRef(null);
  const detailFade = useRef(new Animated.Value(1)).current;

  // ── Fetch product + similar items ─────────────────────────────────────────
  const loadProduct = useCallback(async (id, isSwitch = false) => {
    try {
      if (isSwitch) {
        // Fade out before switching
        await new Promise((res) => {
          Animated.timing(detailFade, { toValue: 0, duration: 180, useNativeDriver: true }).start(res);
        });
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch the product and all items in parallel
      const [productRes, allItemsRes] = await Promise.all([
        getItemByUniqueId(id),
        getAllItems(0, 200),
      ]);

      const fetchedProduct = productRes.data;
      const allItems       = allItemsRes.data ?? [];

      setProduct(fetchedProduct);
      // Show the full catalog here, including the currently viewed product.
      setSimilar(allItems);
      setCurrentId(id);

      // Update header title
      navigation.setOptions({ title: fetchedProduct.title });

      if (isSwitch) {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
        Animated.timing(detailFade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      }
    } catch (err) {
      console.error('ProductScreen fetch error:', err);
      setError('Could not load product.');
      if (isSwitch) {
        Animated.timing(detailFade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  // Initial load
  useEffect(() => { loadProduct(initialId, false); }, [initialId]);

  // Switch product in-place when similar card is tapped
  const switchProduct = useCallback((newId) => {
    loadProduct(String(newId), true);
  }, [loadProduct]);

  const handleWhatsAppPress = useCallback(async () => {
    const raw = (WHATSAPP_NUMBER || '').trim();
    const normalized = (raw && raw !== '919999999999' ? raw : FALLBACK_WHATSAPP_NUMBER)
      .replace(/[^\d]/g, '');
    const message = encodeURIComponent(`Hi, I am interested in ${product?.title || 'this item'}.`);
    const url = `https://wa.me/${normalized}?text=${message}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
      await Linking.openURL(`https://wa.me/${normalized}`);
    } catch {
      Alert.alert('WhatsApp unavailable', 'Please check WhatsApp on this device.');
    }
  }, [product?.title]);

  const handleCallPress = useCallback(async () => {
    const callUrl = `tel:${CALL_NUMBER}`;
    try {
      const canOpen = await Linking.canOpenURL(callUrl);
      if (!canOpen) {
        Alert.alert('Call unavailable', `Please dial ${CALL_NUMBER} manually.`);
        return;
      }
      await Linking.openURL(callUrl);
    } catch {
      Alert.alert('Call failed', `Please dial ${CALL_NUMBER} manually.`);
    }
  }, []);

  // Keep hooks above early returns to preserve hook order across renders.
  const renderSimilar = useCallback(({ item }) => (
    <SimilarCard item={item} onPress={switchProduct} />
  ), [switchProduct]);

  const keyExtractor = useCallback((item) => item.unique_id, []);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return <ProductSkeleton onBack={() => navigation.goBack()} />;
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !product) {
    return (
      <View style={styles.errorScreen}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Product not found</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadProduct(currentId, false)}>
          <Text style={styles.retryTxt}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
          <Text style={{ color: COLORS.muted, fontSize: 13 }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Build image list ───────────────────────────────────────────────────────
  // image_url is the main image; variants (if they are URLs) shown in gallery too
  const variantUrls = Array.isArray(product.variants) ? product.variants.filter(
    (v) => typeof v === 'string' && v.startsWith('http')
  ) : [];

  // Gallery: main image first, then variant URLs (deduplicated)
  const galleryImages = [product.image_url, ...variantUrls.filter((v) => v !== product.image_url)];

  // ── Tags: parse from category string or use category as single tag
  const tags = product.category ? product.category.split(',').map((t) => t.trim()) : [];
  const configuredRelatedIds = Array.isArray(product.related_items)
    ? product.related_items.filter((id) => typeof id === 'string' && id.trim()).slice(0, 3)
    : [];

  const similarById = new Map(similar.map((item) => [item.unique_id, item]));
  const matchingEntries = configuredRelatedIds.map((matchId) => {
    const normalizedId = String(matchId).trim();
    if (!normalizedId) return null;
    const linked = similarById.get(normalizedId);
    return {
      unique_id: normalizedId,
      title: linked?.title || normalizedId,
      image_url: linked?.image_url || null,
    };
  }).filter(Boolean);

  // ── List header (full product showcase) ───────────────────────────────────
  const ListHeader = (
    <View>
      <ImageGallery images={galleryImages} onBack={() => navigation.goBack()} />

      <Animated.View style={[styles.detailsCard, { opacity: detailFade }]}>

        {/* Tags */}
        <View style={styles.tagsRow}>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipTxt}>{product.category || 'Clothing'}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.productTitle}>{product.title}</Text>

        {/* Price */}
        <Text style={styles.productPrice}>
          {product.price === 0
            ? 'Price on request'
            : `₹${product.price.toLocaleString('en-IN')}`}
        </Text>

        <View style={styles.divider} />

        {/* Description */}
        {product.description ? (
          <>
            <Text style={styles.sectionLabel}>About this piece</Text>
            <Text style={styles.descriptionTxt}>{product.description}</Text>
            <View style={styles.divider} />
          </>
        ) : null}

        {/* Contact CTAs */}
        <View style={styles.contactRow}>
          <TouchableOpacity
            style={[styles.contactBtn, styles.contactBtnWhatsApp]}
            activeOpacity={0.9}
            onPress={handleWhatsAppPress}
          >
            <View style={[styles.contactSheen, styles.contactSheenWhatsApp]} />
            <View style={[styles.contactIconBadge, styles.contactIconBadgeWhatsApp]}>
              <Text style={styles.contactIconTxt}>💬</Text>
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactTitle}>WhatsApp Chat</Text>
              <Text style={styles.contactSub}>Fast reply</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contactBtn, styles.contactBtnCall]}
            activeOpacity={0.9}
            onPress={handleCallPress}
          >
            <View style={[styles.contactSheen, styles.contactSheenCall]} />
            <View style={[styles.contactIconBadge, styles.contactIconBadgeCall]}>
              <Text style={styles.contactIconTxt}>📞</Text>
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactTitle}>Call Now</Text>
              <Text style={styles.contactSub}>+91 73831 60724</Text>
            </View>
          </TouchableOpacity>
        </View>

      </Animated.View>

      {/* Variant strip — shows additional image views */}
      <Animated.View style={{ opacity: detailFade }}>
        <VariantStrip variants={variantUrls} mainImage={product.image_url} />
      </Animated.View>

      {/* Matching styles for this specific item */}
      <Animated.View style={{ opacity: detailFade }}>
        <MatchingStrip entries={matchingEntries} onPress={switchProduct} />
      </Animated.View>

      {/* Similar items header */}
      {similar.length > 0 && (
        <View style={styles.similarHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.accentBar} />
            <Text style={styles.similarTitle}>More to Explore</Text>
          </View>
          <Text style={styles.similarSub}>You might also love these</Text>
        </View>
      )}
    </View>
  );

  const ListFooter = similar.length > 0 ? (
    <View style={styles.footer}>
      <View style={styles.footerLine} />
      <Text style={styles.footerTxt}>✦  CLOTHY</Text>
      <View style={styles.footerLine} />
    </View>
  ) : null;

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <FlatList
        ref={listRef}
        data={similar}
        keyExtractor={keyExtractor}
        renderItem={renderSimilar}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        removeClippedSubviews={true}
        windowSize={10}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FAF7F2' },
  listContent: { paddingBottom: 40 },

  // Gallery
  galleryWrap:    { width: W, height: IMG_H, backgroundColor: '#1A1008' },
  gallerySlide:   { width: W, height: IMG_H },
  galleryImage:   { width: '100%', height: '100%' },
  galleryScrim:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.18)' },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 44 : 54, left: 14,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center', justifyContent: 'center', zIndex: 20,
  },
  backChevron:    { color: '#fff', fontSize: 26, fontWeight: '300', marginTop: -2, marginLeft: -2 },
  imgCounter:     { position: 'absolute', top: Platform.OS === 'android' ? 48 : 58, right: 16, backgroundColor: 'rgba(0,0,0,0.38)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, zIndex: 20 },
  imgCounterText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  dotsRow:        { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', gap: 6, zIndex: 20 },
  dot:            { height: 5, borderRadius: 3 },
  dotActive:      { width: 20, backgroundColor: '#C9A84C' },
  dotInactive:    { width: 5,  backgroundColor: 'rgba(255,255,255,0.45)' },

  // Details card
  detailsCard:     { backgroundColor: '#FAF7F2', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 },
  tagsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  categoryChip:    { backgroundColor: COLORS.primary, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 20 },
  categoryChipTxt: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  productTitle:    { color: '#1A1008', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30, marginBottom: 8 },
  productPrice:    { color: COLORS.primary, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  divider:         { height: 1, backgroundColor: '#E8E0D0', marginVertical: 18 },
  sectionLabel:    { color: '#888', fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  descriptionTxt:  { color: '#666', fontSize: 14, lineHeight: 22, letterSpacing: 0.1 },

  // Contact row (minimal premium cards)
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.78)',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 5,
  },
  contactBtnWhatsApp: {
    borderColor: 'rgba(37, 211, 102, 0.30)',
    shadowColor: '#20B45A',
  },
  contactBtnCall: {
    borderColor: 'rgba(108, 52, 131, 0.24)',
    shadowColor: '#6C3483',
  },
  contactSheen: {
    position: 'absolute',
    top: -26,
    right: -18,
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  contactSheenWhatsApp: {
    backgroundColor: 'rgba(37, 211, 102, 0.20)',
  },
  contactSheenCall: {
    backgroundColor: 'rgba(108, 52, 131, 0.14)',
  },
  contactIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  contactIconBadgeWhatsApp: {
    backgroundColor: 'rgba(37, 211, 102, 0.14)',
    borderColor: 'rgba(37, 211, 102, 0.24)',
  },
  contactIconBadgeCall: {
    backgroundColor: 'rgba(108, 52, 131, 0.12)',
    borderColor: 'rgba(108, 52, 131, 0.22)',
  },
  contactIconTxt: {
    fontSize: 16,
  },
  contactTextWrap: {
    flex: 1,
  },
  contactTitle: {
    color: '#1A1008',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
    marginBottom: 2,
  },
  contactSub: {
    color: '#6F5C4B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Variant strip
  variantSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, backgroundColor: '#FAF7F2' },
  variantHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  accentBar:      { width: 4, height: 20, backgroundColor: '#C9A84C', borderRadius: 2 },
  variantLabel:   { color: '#1A1008', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  variantRow:     { flexDirection: 'row', gap: 10 },
  variantCard:    { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#1A1008', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  variantImg:     { width: '100%', aspectRatio: 1 },

  // Matching strip
  matchSection: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, backgroundColor: '#FAF7F2' },
  matchSub:     { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginBottom: 14, marginLeft: 14 },
  matchRow:     { flexDirection: 'row', gap: 10 },
  matchCard:    { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', paddingBottom: 10, shadowColor: '#1A1008', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  matchImg:     { width: '100%', aspectRatio: 0.9, backgroundColor: '#F0EBE1' },
  matchPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  matchPlaceholderTxt: { color: '#A0896A', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  matchTitle:   { color: COLORS.text, fontSize: 11, fontWeight: '700', lineHeight: 16, paddingHorizontal: 8, paddingTop: 8 },

  // Similar section
  similarHeader:   { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16, backgroundColor: '#FAF7F2' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  similarTitle:    { color: '#1A1008', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  similarSub:      { color: '#888', fontSize: 13, marginLeft: 14, letterSpacing: 0.2 },
  gridRow:         { paddingHorizontal: 12, gap: 12 },

  // Similar card
  simCard:    { backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', shadowColor: '#1A1008', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, marginBottom: 14 },
  simImgWrap: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#F0EBE1' },
  simImg:     { width: '100%', height: '100%' },
  simPill:    { position: 'absolute', top: 8, left: 8, backgroundColor: COLORS.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  simPillTxt: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  simInfo:    { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12 },
  simTitle:   { color: COLORS.text, fontSize: 13, fontWeight: '700', lineHeight: 18, letterSpacing: -0.1 },
  simPrice:   { color: COLORS.primary, fontSize: 14, fontWeight: '800', marginTop: 6, letterSpacing: -0.2 },

  // Skeleton
  skelLine:   { borderRadius: 6, backgroundColor: '#D8CFC0', marginBottom: 4 },

  // Footer
  footer:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 40, gap: 10 },
  footerLine: { flex: 1, height: 1, backgroundColor: '#E2D9C8' },
  footerTxt:  { color: '#C9A84C', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  // Error screen
  errorScreen: { flex: 1, backgroundColor: '#FAF7F2', alignItems: 'center', justifyContent: 'center', padding: 40 },
  errorIcon:   { fontSize: 40, marginBottom: 12 },
  errorTitle:  { color: '#1A1008', fontSize: 18, fontWeight: '800', marginBottom: 20 },
  retryBtn:    { backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
});
