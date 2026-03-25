import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const CARD_W = Math.min(138, W * 0.34);
const CARD_H = CARD_W * 1.35;
const GAP = 12;

function TestimonialCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <Image source={{ uri: item.image_url }} style={styles.cardImage} resizeMode="cover" />
    </TouchableOpacity>
  );
}

export default function TestimonialShowcase({ items = [] }) {
  const [modalVisible, setModalVisible] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const seedItems = useMemo(() => {
    if (!items.length) return [];
    if (items.length === 1) return items;
    const repeats = Math.max(1, Math.ceil(6 / items.length));
    return Array.from({ length: repeats }, () => items).flat();
  }, [items]);

  const marqueeItems = useMemo(() => (items.length > 1 ? [...seedItems, ...seedItems] : seedItems), [items.length, seedItems]);
  const singleTrackWidth = useMemo(() => {
    if (!seedItems.length) return 0;
    return seedItems.length * CARD_W + Math.max(seedItems.length - 1, 0) * GAP;
  }, [seedItems]);

  useEffect(() => {
    translateX.stopAnimation();
    if (singleTrackWidth <= 0 || items.length <= 1) {
      translateX.setValue(0);
      return;
    }

    translateX.setValue(-singleTrackWidth);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 0,
        duration: Math.max(18000, seedItems.length * 3600),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => {
      loop.stop();
      translateX.stopAnimation();
    };
  }, [items.length, seedItems.length, singleTrackWidth, translateX]);

  if (!items.length) return null;

  return (
    <>
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.kicker}>REAL WEARERS</Text>
            <Text style={styles.title}>Style Stories</Text>
          </View>
          <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.75}>
            <Text style={styles.linkText}>Show all images</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Looks shared by happy customers, moving through in one calm ribbon.
        </Text>

        <View style={styles.marqueeViewport}>
          <Animated.View
            style={[
              styles.marqueeTrack,
              { transform: [{ translateX: items.length > 1 ? translateX : 0 }] },
            ]}
          >
            {marqueeItems.map((item, index) => (
              <TestimonialCard
                key={`${item.id}-${index}`}
                item={item}
                onPress={() => setModalVisible(true)}
              />
            ))}
          </Animated.View>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>All Style Stories</Text>
                <Text style={styles.modalSub}>{items.length} looks in the gallery</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)} activeOpacity={0.75}>
                <Text style={styles.closeBtnTxt}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.galleryGrid}
            >
              {items.map((item) => (
                <View key={item.id} style={styles.galleryTile}>
                  <Image source={{ uri: item.image_url }} style={styles.galleryImage} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 20,
    borderRadius: 24,
    backgroundColor: '#F3E8D8',
    borderWidth: 1,
    borderColor: '#E6D6BF',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
  },
  titleWrap: {
    flex: 1,
  },
  kicker: {
    color: '#A16D38',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  title: {
    color: '#1A1008',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  linkText: {
    color: '#6C3483',
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
    paddingTop: 4,
  },
  subtitle: {
    color: '#6F5C4B',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  marqueeViewport: {
    overflow: 'hidden',
  },
  marqueeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: GAP,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E9DCCD',
    borderWidth: 1,
    borderColor: '#E2D0B9',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(20, 14, 8, 0.52)',
  },
  modalCard: {
    maxHeight: H * 0.82,
    borderRadius: 24,
    backgroundColor: '#FFF9F1',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: '#E8D8C2',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  modalTitle: {
    color: '#1A1008',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    color: '#8A7765',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#F0E5D8',
  },
  closeBtnTxt: {
    color: '#6C3483',
    fontSize: 12,
    fontWeight: '800',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 14,
  },
  galleryTile: {
    width: (W - 16 * 2 - 18 * 2 - 12) / 2,
    aspectRatio: 0.78,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E9DCCD',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
});
