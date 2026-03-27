// src/screens/HomeScreen.js
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, Animated,
  StatusBar, TouchableOpacity,
} from 'react-native';
import BannerCarousel from '../components/BannerCarousel';
import ItemCard, { ItemCardSkeleton } from '../components/ItemCard';
import TestimonialShowcase from '../components/TestimonialShowcase';
import { getAllItems, getTestimonials } from '../api/services';
import { BASE_URL } from '../api/client';

const LIMIT         = 20;
const SKELETON_COUNT = 8;

export default function HomeScreen({ navigation }) {
  const scrollY     = useRef(new Animated.Value(0)).current;
  const listRef     = useRef(null);
  const pageRef     = useRef(0);

  const [items,        setItems]        = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [error,       setError]       = useState(null);

  // ── Fetch ───────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async (pageNum = 0, isRefresh = false) => {
    try {
      if (pageNum === 0) {
        isRefresh ? setRefreshing(true) : setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      const res = await getAllItems(pageNum * LIMIT, LIMIT);
      const fetched = res.data ?? [];
      setItems((prev) => pageNum === 0 ? fetched : [...prev, ...fetched]);
      setHasMore(fetched.length === LIMIT);
      pageRef.current = pageNum;
    } catch (err) {
      console.error('HomeScreen fetch error:', err);
      setError(`Could not load items from ${BASE_URL}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  const fetchTestimonials = useCallback(async () => {
    try {
      const res = await getTestimonials();
      setTestimonials(res.data ?? []);
    } catch (err) {
      console.error('HomeScreen testimonials fetch error:', err);
      setTestimonials([]);
    }
  }, []);

  useEffect(() => {
    fetchItems(0);
    fetchTestimonials();
  }, [fetchItems, fetchTestimonials]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    fetchItems(0, true);
    fetchTestimonials();
  }, [fetchItems, fetchTestimonials]);
  const handleEndReached = useCallback(() => {
    if (!loadingMore && !loading && hasMore) fetchItems(pageRef.current + 1);
  }, [loadingMore, loading, hasMore, fetchItems]);

  const handleBannerPress = useCallback((item) => {
    navigation.navigate('Product', { uniqueId: item.item_unique_id });
  }, [navigation]);

  const handleItemPress = useCallback((item) => {
    navigation.navigate('Product', { uniqueId: item.unique_id });
  }, [navigation]);

  const renderItem   = useCallback(({ item }) => (
    <ItemCard item={item} onPress={handleItemPress} />
  ), [handleItemPress]);

  const keyExtractor = useCallback((item) => item.unique_id, []);

  // ── List header ─────────────────────────────────────────────────────────
  const ListHeader = (
    <View>
      <BannerCarousel onItemPress={handleBannerPress} />
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>New Collection</Text>
          <TouchableOpacity
            style={styles.adminEntry}
            onPress={() => navigation.navigate('Admin')}
            activeOpacity={0.7}
          >
            <Text style={styles.adminEntryTxt}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSub}>Fresh styles, just for you</Text>
      </View>
    </View>
  );

  // ── Skeleton (first load only) ───────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <Animated.ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
        >
          {ListHeader}
          <View style={styles.skeletonGrid}>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => <ItemCardSkeleton key={i} />)}
          </View>
        </Animated.ScrollView>
      </View>
    );
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const FooterStatus = loadingMore ? (
    <View style={styles.loadingMoreWrap}>
      <Text style={styles.loadingMoreDots}>· · ·</Text>
    </View>
  ) : !hasMore && items.length > 0 ? (
    <View style={styles.footer}>
      <View style={styles.footerLine} />
      <Text style={styles.footerText}>✦ All caught up</Text>
      <View style={styles.footerLine} />
    </View>
  ) : null;

  const ListFooter = (
    <View>
      <TestimonialShowcase items={testimonials} />
      {FooterStatus}
    </View>
  );

  // ── Empty / error ─────────────────────────────────────────────────────────
  const ListEmpty = (
    <View style={styles.emptyWrap}>
      {error ? (
        <>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Connection error</Text>
          <Text style={styles.emptySub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchItems(0)}>
            <Text style={styles.retryTxt}>Try Again</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.emptyIcon}>🛍</Text>
          <Text style={styles.emptyTitle}>No items yet</Text>
          <Text style={styles.emptySub}>Check back soon for new arrivals</Text>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Animated.FlatList
        ref={listRef}
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        windowSize={10}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#FAF7F2' },
  listContent: { paddingBottom: 40 },
  row:         { paddingHorizontal: 12, gap: 12 },

  sectionHeader:   { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 16, backgroundColor: '#FAF7F2' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sectionAccent:   { width: 4, height: 22, backgroundColor: '#C9A84C', borderRadius: 2 },
  sectionTitle:    { color: '#1A1008', fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flex: 1 },
  adminEntry:      { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0EBE1', alignItems: 'center', justifyContent: 'center' },
  adminEntryTxt:   { fontSize: 16 },
  sectionSub:      { color: '#888', fontSize: 13, marginLeft: 14, letterSpacing: 0.2 },

  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 12 },

  loadingMoreWrap: { paddingVertical: 24, alignItems: 'center' },
  loadingMoreDots: { color: '#C9A84C', fontSize: 22, letterSpacing: 6 },

  footer:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 40, gap: 10 },
  footerLine: { flex: 1, height: 1, backgroundColor: '#E2D9C8' },
  footerText: { color: '#C9A84C', fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  emptyWrap:  { margin: 22, padding: 48, borderRadius: 16, backgroundColor: '#F0EBE1', alignItems: 'center', borderWidth: 1, borderColor: '#E2D9C8', borderStyle: 'dashed' },
  emptyIcon:  { fontSize: 36, marginBottom: 12 },
  emptyTitle: { color: '#1A1008', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptySub:   { color: '#A0896A', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  retryBtn:   { backgroundColor: '#6C3483', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryTxt:   { color: '#fff', fontWeight: '700', fontSize: 14 },
});
