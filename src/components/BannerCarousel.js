// src/components/BannerCarousel.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, Dimensions, StyleSheet,
  Animated, TouchableWithoutFeedback, StatusBar, Platform, PanResponder,
  ActivityIndicator,
} from 'react-native';
import { getCatalog } from '../api/services';

const { width: W, height: H } = Dimensions.get('window');
const BANNER_H         = H * 0.68;
const DISPLAY_DURATION = 4000;
const FADE_DURATION    = 900;
const KB_DURATION      = DISPLAY_DURATION + FADE_DURATION;

// Ken Burns motion presets
const KB_PRESETS = [
  { from: { scale: 1.08, x: -18, y: -10 }, to: { scale: 1.18, x: 18,  y: 10  } },
  { from: { scale: 1.12, x: 20,  y: 12  }, to: { scale: 1.04, x: -14, y: -8  } },
  { from: { scale: 1.05, x: 0,   y: -20 }, to: { scale: 1.15, x: 0,   y: 14  } },
  { from: { scale: 1.14, x: -22, y: 0   }, to: { scale: 1.06, x: 16,  y: -10 } },
  { from: { scale: 1.06, x: 14,  y: 16  }, to: { scale: 1.16, x: -12, y: -14 } },
  { from: { scale: 1.10, x: 0,   y: 18  }, to: { scale: 1.18, x: 0,   y: -10 } },
  { from: { scale: 1.15, x: -16, y: -14 }, to: { scale: 1.05, x: 12,  y: 12  } },
];

// ── Pill dot ──────────────────────────────────────────────────────────────────
function Dot({ active }) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: active ? 1 : 0,
      useNativeDriver: false,
      tension: 130, friction: 9,
    }).start();
  }, [active]);
  const width   = anim.interpolate({ inputRange: [0, 1], outputRange: [5, 20] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  return (
    <Animated.View
      style={[styles.dot, { width, opacity, backgroundColor: active ? '#C9A84C' : '#fff' }]}
    />
  );
}

// ── Ken Burns slide ───────────────────────────────────────────────────────────
function KBSlide({ item, index, isVisible, isPrev }) {
  const kb         = KB_PRESETS[index % KB_PRESETS.length];
  const scale      = useRef(new Animated.Value(kb.from.scale)).current;
  const tx         = useRef(new Animated.Value(kb.from.x)).current;
  const ty         = useRef(new Animated.Value(kb.from.y)).current;
  const fade       = useRef(new Animated.Value(isVisible ? 1 : 0)).current;
  const labelFade  = useRef(new Animated.Value(0)).current;
  const labelSlide = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (isVisible) {
      scale.setValue(kb.from.scale);
      tx.setValue(kb.from.x);
      ty.setValue(kb.from.y);

      Animated.timing(fade, { toValue: 1, duration: FADE_DURATION, useNativeDriver: true }).start();

      Animated.parallel([
        Animated.timing(scale, { toValue: kb.to.scale, duration: KB_DURATION, useNativeDriver: true }),
        Animated.timing(tx,    { toValue: kb.to.x,     duration: KB_DURATION, useNativeDriver: true }),
        Animated.timing(ty,    { toValue: kb.to.y,     duration: KB_DURATION, useNativeDriver: true }),
      ]).start();

      labelFade.setValue(0);
      labelSlide.setValue(12);
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(labelFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(labelSlide, { toValue: 0, tension: 80, friction: 11, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      Animated.timing(fade,      { toValue: 0, duration: FADE_DURATION, useNativeDriver: true }).start();
      Animated.timing(labelFade, { toValue: 0, duration: 220,           useNativeDriver: true }).start();
    }
  }, [isVisible]);

  if (!isVisible && !isPrev) return null;

  return (
    <Animated.View style={[styles.slide, { opacity: fade }]} pointerEvents="none">
      <Animated.Image
        source={{ uri: item.image_url }}
        style={[styles.kbImage, { transform: [{ scale }, { translateX: tx }, { translateY: ty }] }]}
        resizeMode="cover"
      />
      <View style={styles.bottomScrim} />
      <View style={styles.topScrim} />
      <Animated.View
        style={[styles.labelWrap, { opacity: labelFade, transform: [{ translateY: labelSlide }] }]}
      >
        <View style={styles.labelLine} />
        {/* Use category as subtitle if available, otherwise empty */}
        <Text style={styles.labelSub}>{(item.category || '').toUpperCase()}</Text>
        <Text style={styles.labelMain}>{item.title}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Loading skeleton for banner ───────────────────────────────────────────────
function BannerSkeleton() {
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
    <Animated.View style={[styles.container, { opacity: pulse, backgroundColor: '#2A1F2D' }]}>
      <View style={styles.skeletonLabel}>
        <View style={styles.skeletonLine1} />
        <View style={styles.skeletonLine2} />
      </View>
    </Animated.View>
  );
}

// ── Main carousel ─────────────────────────────────────────────────────────────
export default function BannerCarousel({ onItemPress }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [current, setCurrent] = useState(0);
  const [prev,    setPrev]    = useState(null);
  const timerRef = useRef(null);

  // ── Fetch catalog from API ──────────────────────────────────────────────
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getCatalog();
        if (res.data && res.data.length > 0) {
          setItems(res.data);
        } else {
          setError('No catalog items found.');
        }
      } catch (err) {
        console.error('BannerCarousel fetch error:', err);
        setError('Could not load banner.');
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const n = items.length;

  const advance = useCallback((dir = 1) => {
    if (n === 0) return;
    setCurrent((cur) => {
      const next = ((cur + dir) % n + n) % n;
      setPrev(cur);
      return next;
    });
  }, [n]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (n > 1) {
      timerRef.current = setInterval(() => advance(1), DISPLAY_DURATION);
    }
  }, [advance, n]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  // Swipe gesture
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 40,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 30) {
          clearInterval(timerRef.current);
          advance(g.dx < 0 ? 1 : -1);
          startTimer();
        }
      },
    })
  ).current;

  const tapPrev = () => { clearInterval(timerRef.current); advance(-1); startTimer(); };
  const tapNext = () => { clearInterval(timerRef.current); advance(1);  startTimer(); };

  if (loading) return <BannerSkeleton />;

  if (error || items.length === 0) {
    return (
      <View style={[styles.container, styles.errorWrap]}>
        <Text style={styles.errorText}>✦ Catalog unavailable</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} {...pan.panHandlers}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {items.map((item, i) => (
        <KBSlide
          key={`${item.id ?? item.item_unique_id}-${i}`}
          item={item}
          index={i}
          isVisible={i === current}
          isPrev={i === prev}
        />
      ))}

      {/* Invisible tap zones */}
      <TouchableWithoutFeedback onPress={tapPrev}>
        <View style={styles.tapLeft} />
      </TouchableWithoutFeedback>
      <TouchableWithoutFeedback onPress={() => onItemPress && onItemPress(items[current])}>
        <View style={styles.tapCenter} />
      </TouchableWithoutFeedback>
      <TouchableWithoutFeedback onPress={tapNext}>
        <View style={styles.tapRight} />
      </TouchableWithoutFeedback>

      {/* Brand tag */}
      <View style={styles.brandTag} pointerEvents="none">
        <Text style={styles.brandText}>✦ CLOTHY</Text>
      </View>

      {/* Chevrons */}
      {n > 1 && (
        <>
          <View style={styles.chevronLeft}  pointerEvents="none"><Text style={styles.chevron}>‹</Text></View>
          <View style={styles.chevronRight} pointerEvents="none"><Text style={styles.chevron}>›</Text></View>
        </>
      )}

      {/* Dots */}
      {n > 1 && (
        <View style={styles.dotsRow} pointerEvents="none">
          {items.map((_, i) => <Dot key={i} active={i === current} />)}
        </View>
      )}

      {/* Counter */}
      {n > 1 && (
        <View style={styles.counter} pointerEvents="none">
          <Text style={styles.counterNum}>{String(current + 1).padStart(2, '0')}</Text>
          <Text style={styles.counterMuted}> / {String(n).padStart(2, '0')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { width: W, height: BANNER_H, backgroundColor: '#111', overflow: 'hidden' },
  slide:       { ...StyleSheet.absoluteFillObject },
  kbImage: {
    width: W + 60, height: BANNER_H + 60,
    marginLeft: -30, marginTop: -30,
    position: 'absolute',
  },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.26)' },
  topScrim:    { position: 'absolute', top: 0,    left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.16)' },

  labelWrap:  { position: 'absolute', bottom: 52, left: 20 },
  labelLine:  { width: 18, height: 1.5, backgroundColor: '#C9A84C', marginBottom: 7, borderRadius: 1 },
  labelSub:   { color: 'rgba(255,255,255,0.5)',  fontSize: 9,  fontWeight: '700', letterSpacing: 2.5, marginBottom: 3 },
  labelMain:  { color: 'rgba(255,255,255,0.86)', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  brandTag:   { position: 'absolute', top: Platform.OS === 'android' ? 44 : 54, left: 18, zIndex: 20 },
  brandText:  { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '700', letterSpacing: 3 },

  dotsRow:    { position: 'absolute', bottom: 20, left: 20, flexDirection: 'row', alignItems: 'center', gap: 5, zIndex: 20 },
  dot:        { height: 5, borderRadius: 3 },

  counter:      { position: 'absolute', bottom: 18, right: 20, flexDirection: 'row', zIndex: 20 },
  counterNum:   { color: '#fff',                   fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  counterMuted: { color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '400', letterSpacing: 1 },

  tapLeft:   { position: 'absolute', left: 0,        top: 0, width: W * 0.22, height: BANNER_H, zIndex: 10 },
  tapRight:  { position: 'absolute', right: 0,       top: 0, width: W * 0.22, height: BANNER_H, zIndex: 10 },
  tapCenter: { position: 'absolute', left: W * 0.22, top: 0, width: W * 0.56, height: BANNER_H, zIndex: 10 },

  chevronLeft:  { position: 'absolute', left: 10,  top: BANNER_H / 2 - 20, zIndex: 20 },
  chevronRight: { position: 'absolute', right: 10, top: BANNER_H / 2 - 20, zIndex: 20 },
  chevron:      { color: 'rgba(255,255,255,0.25)', fontSize: 36, fontWeight: '200' },

  // skeleton
  skeletonLabel: { position: 'absolute', bottom: 52, left: 20 },
  skeletonLine1: { width: 120, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 8 },
  skeletonLine2: { width: 80,  height: 9,  borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.07)' },

  // error
  errorWrap: { alignItems: 'center', justifyContent: 'center' },
  errorText: { color: 'rgba(255,255,255,0.3)', fontSize: 13, letterSpacing: 2 },
});