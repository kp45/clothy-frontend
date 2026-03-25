// src/screens/AdminScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, Image, Alert, ActivityIndicator,
  Animated, KeyboardAvoidingView, Platform, StatusBar, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getAllItems, getItemByUniqueId, createItem,
  updateItem, deleteItem, addToCatalog,
  removeFromCatalog, getCatalog, uploadImage,
  getTestimonials, createTestimonial, deleteTestimonial,
} from '../api/services';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 16 * 2 - 12) / 2;

const ADMIN_PASSWORD = 'Lenovo@45';
const PRIMARY = '#6C3483';
const GOLD    = '#C9A84C';
const BG      = '#FAF7F2';
const CARD_BG = '#FFFFFF';
const DANGER  = '#E53935';
const SUCCESS = '#2E7D32';
const BORDER  = '#E8E0D0';
const MUTED   = '#888';

// ── Shared helpers ────────────────────────────────────────────────────────────
function SectionTitle({ label }) {
  return (
    <View style={s.sectionTitleRow}>
      <View style={s.sectionAccent} />
      <Text style={s.sectionTitle}>{label}</Text>
    </View>
  );
}

function ActionBtn({ label, color = PRIMARY, onPress, loading, icon, small }) {
  return (
    <TouchableOpacity
      style={[s.actionBtn, { backgroundColor: color }, small && s.actionBtnSmall]}
      onPress={onPress} activeOpacity={0.8} disabled={loading}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={[s.actionBtnTxt, small && s.actionBtnTxtSmall]}>
            {icon ? `${icon}  ` : ''}{label}
          </Text>}
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{String(value)}</Text>
    </View>
  );
}

function Field({ label, value, onChange, multiline, keyboardType }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && s.fieldInputMulti]}
        value={value || ''}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor="#ccc"
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />
    </View>
  );
}

// ── Image Picker Field ────────────────────────────────────────────────────────
// Replaces the plain "Image URL" text input in Create/Edit forms.
// Shows a preview thumbnail + upload button + the resulting URL.
function ImagePickerField({ value, onChange }) {
  const [uploading, setUploading] = useState(false);

  const requestPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow access to your photo library in Settings to upload images.',
      );
      return false;
    }
    return true;
  };

  const handlePick = async () => {
    const granted = await requestPermission();
    if (!granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      // SDK 55 prefers explicit media type strings/arrays over deprecated enums
      mediaTypes: ['images'],
      allowsEditing: true,       // lets user crop before upload
      aspect: [3, 4],            // matches the card aspect ratio
      quality: 0.82,             // good quality, reasonable file size
    });

    if (result.canceled || !result.assets?.[0]) return;

    const localUri = result.assets[0].uri;

    try {
      setUploading(true);
      const publicUrl = await uploadImage(localUri);
      onChange(publicUrl);       // auto-fills image_url in the form
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Upload failed', 'Could not upload image. Check your connection.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>Product Image</Text>

      {/* Preview thumbnail — shows current URL if available */}
      {value ? (
        <View style={s.imgPreviewWrap}>
          <Image
            source={{ uri: value }}
            style={s.imgPreview}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={s.imgChangeBadge}
            onPress={handlePick}
            activeOpacity={0.8}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.imgChangeBadgeTxt}>📷  Change</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        /* No image yet — show upload button */
        <TouchableOpacity
          style={s.imgPickerBtn}
          onPress={handlePick}
          activeOpacity={0.8}
          disabled={uploading}
        >
          {uploading ? (
            <View style={s.imgPickerInner}>
              <ActivityIndicator color={PRIMARY} size="small" />
              <Text style={s.imgPickerUploading}>Uploading…</Text>
            </View>
          ) : (
            <View style={s.imgPickerInner}>
              <Text style={s.imgPickerIcon}>🖼</Text>
              <Text style={s.imgPickerTxt}>Tap to pick from gallery</Text>
              <Text style={s.imgPickerSub}>JPEG · PNG · WEBP · max 10 MB</Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* URL text field — still editable manually for paste-in links */}
      <TextInput
        style={[s.fieldInput, { marginTop: 8, fontSize: 11, color: MUTED }]}
        value={value || ''}
        onChangeText={onChange}
        placeholder="Or paste an image URL directly"
        placeholderTextColor="#ccc"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

// ── Password Gate ─────────────────────────────────────────────────────────────
function PasswordGate({ onUnlock }) {
  const [pass, setPass]   = useState('');
  const [error, setError] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  const doShake = () => Animated.sequence([
    Animated.timing(shake, { toValue: 10,  duration: 55, useNativeDriver: true }),
    Animated.timing(shake, { toValue: -10, duration: 55, useNativeDriver: true }),
    Animated.timing(shake, { toValue: 6,   duration: 55, useNativeDriver: true }),
    Animated.timing(shake, { toValue: 0,   duration: 55, useNativeDriver: true }),
  ]).start();

  const tryUnlock = () => {
    if (pass === ADMIN_PASSWORD) { onUnlock(); }
    else { setError(true); doShake(); setTimeout(() => setError(false), 1500); }
  };

  return (
    <KeyboardAvoidingView style={s.gateWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />
      <Text style={s.gateLogoText}>✦ CLOTHY</Text>
      <Text style={s.gateSubText}>Admin Panel</Text>
      <Animated.View style={[s.gateCard, { transform: [{ translateX: shake }] }]}>
        <Text style={s.gateLabel}>Password</Text>
        <TextInput
          style={[s.gateInput, error && { borderColor: DANGER }]}
          placeholder="••••••••" placeholderTextColor="#555"
          secureTextEntry value={pass}
          onChangeText={t => { setPass(t); setError(false); }}
          onSubmitEditing={tryUnlock} returnKeyType="done" autoCapitalize="none"
        />
        {error && <Text style={s.gateError}>Wrong password</Text>}
        <TouchableOpacity style={s.gateBtn} onPress={tryUnlock} activeOpacity={0.85}>
          <Text style={s.gateBtnTxt}>Unlock</Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ── Browse Tab ────────────────────────────────────────────────────────────────
function BrowseTab({ onSelectItem }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const res = await getAllItems(0, 100);
      setItems(res.data || []);
    } catch { Alert.alert('Error', 'Could not load items.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={s.browseCard}
      onPress={() => onSelectItem(item)}
      activeOpacity={0.82}
    >
      <Image source={{ uri: item.image_url }} style={s.browseImg} resizeMode="cover" />
      <View style={s.browseBadge}>
        <Text style={s.browseBadgeTxt} numberOfLines={1}>{item.unique_id}</Text>
      </View>
      <View style={s.browseInfo}>
        <Text style={s.browseTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={s.browsePrice}>
          {item.price === 0 ? 'On request' : `₹${item.price.toLocaleString('en-IN')}`}
        </Text>
      </View>
      <View style={s.browseArrow}>
        <Text style={s.browseArrowTxt}>›</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) return (
    <View style={s.centerWrap}>
      <ActivityIndicator color={PRIMARY} size="large" />
      <Text style={s.loadingTxt}>Loading items…</Text>
    </View>
  );

  return (
    <FlatList
      data={items}
      keyExtractor={i => i.unique_id}
      renderItem={renderItem}
      numColumns={2}
      columnWrapperStyle={s.browseRow}
      contentContainerStyle={s.browseContent}
      showsVerticalScrollIndicator={false}
      refreshing={refreshing}
      onRefresh={() => fetchAll(true)}
      ListHeaderComponent={
        <View style={{ paddingBottom: 12 }}>
          <SectionTitle label="All Items" />
          <Text style={s.hintText}>Tap any item to edit, delete, or manage it.</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={s.centerWrap}>
          <Text style={s.emptyTxt}>No items yet. Create one in the Manage tab.</Text>
        </View>
      }
    />
  );
}

// ── CRUD Tab ──────────────────────────────────────────────────────────────────
function CrudTab({ preselectedItem, onClearPreselect }) {
  const [uid,     setUid]     = useState('');
  const [item,    setItem]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [mode,    setMode]    = useState(null); // 'view'|'edit'|'create'
  const [form,    setForm]    = useState({});
  const scrollRef = useRef(null);

  const makeDefaultRelatedItems = () => [];

  const createEmptyForm = () => ({
    title: '', image_url: '', price: '',
    category: '', description: '', variants: '',
    related_items: makeDefaultRelatedItems().join(', '),
  });

  const toast = (msg, err) => Alert.alert(err ? '⚠️ Error' : '✅ Done', msg);

  const fillFromItem = useCallback((it) => {
    const relatedItems = Array.isArray(it.related_items) ? it.related_items : [];

    setUid(it.unique_id);
    setItem(it);
    setForm({
      title:       it.title,
      image_url:   it.image_url,
      price:       String(it.price),
      category:    it.category,
      description: it.description,
      variants:    (it.variants || []).join(', '),
      related_items: relatedItems.join(', '),
    });
    setMode('view');
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  }, []);

  useEffect(() => {
    if (preselectedItem) { fillFromItem(preselectedItem); onClearPreselect(); }
  }, [preselectedItem]);

  const handleFetch = useCallback(async () => {
    if (!uid.trim()) { toast('Enter a unique ID first.', true); return; }
    try {
      setLoading(true); setItem(null); setMode(null);
      const res = await getItemByUniqueId(uid.trim());
      fillFromItem(res.data);
    } catch { toast('Item not found.', true); }
    finally { setLoading(false); }
  }, [uid]);

  const buildPayload = () => ({
    title:       form.title,
    image_url:   form.image_url,
    price:       parseFloat(form.price) || 0,
    category:    form.category,
    description: form.description,
    variants:    form.variants
      ? form.variants.split(',').map(v => v.trim()).filter(Boolean)
      : [],
    related_items: (() => {
      return form.related_items
        ? form.related_items.split(',').map(v => v.trim()).filter(Boolean).slice(0, 3)
        : [];
    })(),
  });

  const handleUpdate = useCallback(async () => {
    if (!form.image_url) { toast('Please add a product image first.', true); return; }
    try {
      setSaving(true);
      await updateItem(uid.trim(), buildPayload());
      toast('Item updated!');
      handleFetch();
    } catch { toast('Update failed.', true); }
    finally { setSaving(false); setMode('view'); }
  }, [uid, form]);

  const handleDelete = () => {
    Alert.alert('Delete', `Delete "${item?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setSaving(true);
          await deleteItem(uid.trim());
          toast('Deleted.');
          setItem(null); setMode(null); setUid('');
        } catch { toast('Delete failed.', true); }
        finally { setSaving(false); }
      }},
    ]);
  };

  const handleCreate = useCallback(async () => {
    if (!uid.trim())      { toast('Enter a unique ID first.', true); return; }
    if (!form.title)      { toast('Title is required.', true); return; }
    if (!form.image_url)  { toast('Please add a product image first.', true); return; }
    try {
      setSaving(true);
      await createItem({ unique_id: uid.trim(), ...buildPayload() });
      toast('Item created!');
      handleFetch();
    } catch (e) { toast(e?.response?.data?.detail || 'Create failed.', true); }
    finally { setSaving(false); }
  }, [uid, form]);

  const f = (key, label, opts = {}) => (
    <Field key={key} label={label} value={form[key]}
      onChange={v => setForm(p => ({ ...p, [key]: v }))}
      multiline={opts.multiline} keyboardType={opts.keyboardType} />
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle label="Item Operations" />
      <Text style={s.hintText}>
        Search by ID, or come from the Browse tab — item fills in automatically.
      </Text>

      {/* ID row */}
      <View style={s.uidRow}>
        <TextInput
          style={s.uidInput}
          placeholder="Unique Item ID"
          placeholderTextColor="#bbb"
          value={uid}
          onChangeText={setUid}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={handleFetch}
        />
        <TouchableOpacity style={s.uidSearchBtn} onPress={handleFetch} activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.uidSearchTxt}>Search</Text>}
        </TouchableOpacity>
      </View>

      {/* View mode */}
      {mode === 'view' && item && (
        <View style={s.itemCard}>
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={s.itemThumb} resizeMode="cover" />
            : null}
          <InfoRow label="ID"          value={item.unique_id} />
          <InfoRow label="Title"       value={item.title} />
          <InfoRow label="Category"    value={item.category} />
          <InfoRow label="Price"       value={item.price === 0 ? 'On request' : `₹${item.price}`} />
          <InfoRow label="Description" value={item.description} />
          <InfoRow label="Variants"    value={(item.variants || []).length > 0 ? `${item.variants.length} variant(s)` : '—'} />
          <InfoRow
            label="Matching IDs"
            value={(item.related_items || []).join(', ')}
          />
          <View style={s.actionRow}>
            <ActionBtn label="Edit"   icon="✏️" color={PRIMARY} onPress={() => setMode('edit')} />
            <ActionBtn label="Delete" icon="🗑"  color={DANGER}  onPress={handleDelete} loading={saving} />
          </View>
        </View>
      )}

      {/* Edit form */}
      {mode === 'edit' && (
        <View style={s.formCard}>
          <Text style={s.formCardTitle}>Editing: {uid}</Text>

          {/* Image picker — replaces plain image_url field */}
          <ImagePickerField
            value={form.image_url}
            onChange={v => setForm(p => ({ ...p, image_url: v }))}
          />

          {f('title',       'Title')}
          {f('price',       'Price', { keyboardType: 'decimal-pad' })}
          {f('category',    'Category')}
          {f('description', 'Description', { multiline: true })}
          {f('variants',    'Extra image URLs (comma-separated)', { multiline: true })}
          {f('related_items', 'Matching item IDs (comma-separated, 3 max)', { multiline: true })}

          <View style={s.actionRow}>
            <ActionBtn label="Save"   icon="💾" color={SUCCESS} onPress={handleUpdate} loading={saving} />
            <ActionBtn label="Cancel"            color={MUTED}  onPress={() => setMode('view')} />
          </View>
        </View>
      )}

      {/* Create form */}
      {mode === 'create' && (
        <View style={s.formCard}>
          <Text style={s.formCardTitle}>New Item · ID: {uid}</Text>

          {/* Image picker at the top of create form */}
          <ImagePickerField
            value={form.image_url}
            onChange={v => setForm(p => ({ ...p, image_url: v }))}
          />

          {f('title',       'Title')}
          {f('price',       'Price', { keyboardType: 'decimal-pad' })}
          {f('category',    'Category')}
          {f('description', 'Description', { multiline: true })}
          {f('variants',    'Extra image URLs (comma-separated)', { multiline: true })}
          {f('related_items', 'Matching item IDs (comma-separated, 3 max)', { multiline: true })}

          <View style={s.actionRow}>
            <ActionBtn label="Create" icon="✨" color={SUCCESS} onPress={handleCreate} loading={saving} />
            <ActionBtn label="Cancel"            color={MUTED}  onPress={() => setMode(null)} />
          </View>
        </View>
      )}

      {/* Not found → prompt create */}
      {mode === null && uid.trim() !== '' && !loading && (
        <View style={s.createHint}>
          <Text style={s.createHintTxt}>No item found. Create with this ID?</Text>
          <ActionBtn
            label="Create New Item" icon="➕" color={GOLD}
            onPress={() => { setForm(createEmptyForm()); setMode('create'); }}
          />
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Catalog Tab ───────────────────────────────────────────────────────────────
function CatalogTab() {
  const [catalog,  setCatalog]  = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [uid,      setUid]      = useState('');
  const [pos,      setPos]      = useState('0');
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const toast = (msg, err) => Alert.alert(err ? '⚠️ Error' : '✅ Done', msg);

  const fetchBoth = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, itemsRes] = await Promise.all([getCatalog(), getAllItems(0, 100)]);
      setCatalog(catRes.data || []);
      setAllItems(itemsRes.data || []);
    } catch { toast('Could not load data.', true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBoth(); }, []);

  const handleAdd = useCallback(async () => {
    if (!uid.trim()) { toast('Enter a unique ID.', true); return; }
    try {
      setSaving(true);
      await addToCatalog(uid.trim(), parseInt(pos) || 0);
      toast('Added to banner!');
      setUid(''); setPos('0'); fetchBoth();
    } catch (e) { toast(e?.response?.data?.detail || 'Add failed. Check ID exists.', true); }
    finally { setSaving(false); }
  }, [uid, pos]);

  const handleAddFromList = (item) => {
    Alert.alert('Add to Banner', `Add "${item.title}" to the banner?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: async () => {
        try {
          setSaving(true);
          await addToCatalog(item.unique_id, catalog.length);
          toast('Added!'); fetchBoth();
        } catch (e) { toast(e?.response?.data?.detail || 'Already in banner?', true); }
        finally { setSaving(false); }
      }},
    ]);
  };

  const handleRemove = (entryUid, title) => {
    Alert.alert('Remove', `Remove "${title}" from banner?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try {
          setSaving(true);
          await removeFromCatalog(entryUid);
          toast('Removed.'); fetchBoth();
        } catch { toast('Remove failed.', true); }
        finally { setSaving(false); }
      }},
    ]);
  };

  const catalogIds  = new Set(catalog.map(c => c.item_unique_id));
  const notInBanner = allItems.filter(i => !catalogIds.has(i.unique_id));

  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent} keyboardShouldPersistTaps="handled">
      <SectionTitle label="Banner Catalog" />
      <Text style={s.hintText}>Current banner images. Tap ✕ to remove, or add from items below.</Text>

      {loading && catalog.length === 0
        ? <ActivityIndicator color={PRIMARY} style={{ marginVertical: 24 }} />
        : catalog.length === 0
        ? <View style={s.emptyBox}><Text style={s.emptyTxt}>Banner is empty.</Text></View>
        : catalog.map((entry, idx) => (
          <View key={entry.id} style={s.catalogRow}>
            <View style={s.catalogNum}><Text style={s.catalogNumTxt}>{idx + 1}</Text></View>
            <Image source={{ uri: entry.image_url }} style={s.catalogThumb} resizeMode="cover" />
            <View style={s.catalogRowInfo}>
              <Text style={s.catalogRowTitle} numberOfLines={1}>{entry.title}</Text>
              <Text style={s.catalogRowId}>ID: {entry.item_unique_id}</Text>
            </View>
            <TouchableOpacity style={s.removeBtn}
              onPress={() => handleRemove(entry.item_unique_id, entry.title)} activeOpacity={0.75}>
              <Text style={s.removeBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      }

      <View style={s.catalogAddCard}>
        <Text style={s.formCardTitle}>Add by ID manually</Text>
        <View style={s.uidRow}>
          <TextInput style={[s.uidInput, { flex: 1 }]} placeholder="Item unique ID"
            placeholderTextColor="#bbb" value={uid} onChangeText={setUid} autoCapitalize="none" />
          <TextInput style={[s.uidInput, { width: 60 }]} placeholder="Pos"
            placeholderTextColor="#bbb" value={pos} onChangeText={setPos} keyboardType="number-pad" />
        </View>
        <ActionBtn label="Add to Banner" icon="➕" color={GOLD} onPress={handleAdd} loading={saving} />
      </View>

      {notInBanner.length > 0 && (
        <>
          <SectionTitle label="Add from Items" />
          <Text style={s.hintText}>Items not yet in the banner — tap to add.</Text>
          {notInBanner.map(item => (
            <TouchableOpacity key={item.unique_id} style={s.catalogRow}
              onPress={() => handleAddFromList(item)} activeOpacity={0.8}>
              <Image source={{ uri: item.image_url }} style={s.catalogThumb} resizeMode="cover" />
              <View style={s.catalogRowInfo}>
                <Text style={s.catalogRowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.catalogRowId}>ID: {item.unique_id}</Text>
              </View>
              <View style={s.addBtn}><Text style={s.addBtnTxt}>+</Text></View>
            </TouchableOpacity>
          ))}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Testimonial Tab ───────────────────────────────────────────────────────────
function TestimonialTab() {
  const [entries,  setEntries]  = useState([]);
  const [imageUrl, setImageUrl] = useState('');
  const [pos,      setPos]      = useState('0');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const toast = (msg, err) => Alert.alert(err ? '⚠️ Error' : '✅ Done', msg);

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getTestimonials();
      const list = res.data || [];
      setEntries(list);
      setPos(String(list.length));
    } catch {
      toast('Could not load testimonial images.', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleAdd = useCallback(async () => {
    if (!imageUrl) {
      toast('Please upload a testimonial image first.', true);
      return;
    }

    const parsedPos = Number.parseInt(pos, 10);

    try {
      setSaving(true);
      await createTestimonial({
        image_url: imageUrl,
        position: Number.isNaN(parsedPos) ? entries.length : parsedPos,
      });
      setImageUrl('');
      toast('Testimonial image added to the home page.');
      fetchEntries();
    } catch {
      toast('Could not save testimonial image.', true);
    } finally {
      setSaving(false);
    }
  }, [imageUrl, pos, entries.length, fetchEntries]);

  const handleRemove = useCallback((entry) => {
    Alert.alert('Remove image', `Remove testimonial image #${entry.id}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            await deleteTestimonial(entry.id);
            toast('Testimonial image removed.');
            fetchEntries();
          } catch {
            toast('Could not remove testimonial image.', true);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [fetchEntries]);

  return (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SectionTitle label="Style Stories" />
      <Text style={s.hintText}>
        Upload real customer look images for the single-row testimonial strip shown at the end of the home page.
      </Text>

      <View style={s.formCard}>
        <Text style={s.formCardTitle}>Add Testimonial Image</Text>
        <ImagePickerField value={imageUrl} onChange={setImageUrl} />
        <View style={s.uidRow}>
          <TextInput
            style={[s.uidInput, { width: 78, flex: 0 }]}
            placeholder="Pos"
            placeholderTextColor="#bbb"
            value={pos}
            onChangeText={setPos}
            keyboardType="number-pad"
          />
          <ActionBtn
            label="Add to Home"
            icon="✨"
            color={GOLD}
            onPress={handleAdd}
            loading={saving}
          />
        </View>
      </View>

      <SectionTitle label="Current Images" />
      <Text style={s.hintText}>Tap remove to take an image out of the scrolling gallery.</Text>

      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={s.loadingTxt}>Loading testimonial images…</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyTxt}>No testimonial images yet.</Text>
        </View>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={s.catalogRow}>
            <Image source={{ uri: entry.image_url }} style={s.catalogThumb} resizeMode="cover" />
            <View style={s.catalogRowInfo}>
              <Text style={s.catalogRowTitle}>Testimonial #{entry.id}</Text>
              <Text style={s.catalogRowId}>Position: {entry.position}</Text>
            </View>
            <TouchableOpacity
              style={s.removeBtn}
              onPress={() => handleRemove(entry)}
              activeOpacity={0.75}
              disabled={saving}
            >
              <Text style={s.removeBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Main AdminScreen ──────────────────────────────────────────────────────────
export default function AdminScreen() {
  const [unlocked,     setUnlocked]     = useState(false);
  const [tab,          setTab]          = useState('browse');
  const [selectedItem, setSelectedItem] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleUnlock = () => {
    setUnlocked(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setTab('crud');
  };

  if (!unlocked) return <PasswordGate onUnlock={handleUnlock} />;

  const TABS = [
    { key: 'browse',      label: '🗂 Browse' },
    { key: 'crud',        label: '✏️ Manage' },
    { key: 'catalog',     label: '🖼 Banner' },
    { key: 'testimonials', label: '📸 Stories' },
  ];

  return (
    <Animated.View style={[s.root, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <View style={s.header}>
        <Text style={s.headerTitle}>Admin Panel</Text>
        <TouchableOpacity style={s.lockBtn} onPress={() => setUnlocked(false)} activeOpacity={0.7}>
          <Text style={s.lockBtnTxt}>🔒 Lock</Text>
        </TouchableOpacity>
      </View>
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)} activeOpacity={0.8}>
            <Text style={[s.tabBtnTxt, tab === t.key && s.tabBtnTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === 'browse'       && <BrowseTab onSelectItem={handleSelectItem} />}
      {tab === 'crud'         && <CrudTab preselectedItem={selectedItem} onClearPreselect={() => setSelectedItem(null)} />}
      {tab === 'catalog'      && <CatalogTab />}
      {tab === 'testimonials' && <TestimonialTab />}
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Gate
  gateWrap:     { flex: 1, backgroundColor: '#12062A', alignItems: 'center', justifyContent: 'center', padding: 32 },
  gateLogoText: { color: GOLD, fontSize: 20, fontWeight: '800', letterSpacing: 4, marginBottom: 4 },
  gateSubText:  { color: 'rgba(255,255,255,0.35)', fontSize: 11, letterSpacing: 2, marginBottom: 40 },
  gateCard:     { width: '100%', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gateLabel:    { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },
  gateInput:    { backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 16, paddingHorizontal: 16, paddingVertical: 14, letterSpacing: 4 },
  gateError:    { color: DANGER, fontSize: 12, marginTop: 8 },
  gateBtn:      { marginTop: 18, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  gateBtnTxt:   { color: '#fff', fontWeight: '800', fontSize: 15 },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 48 : 56, paddingBottom: 14, backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  headerTitle: { color: '#1A1008', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  lockBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0EBE1' },
  lockBtnTxt:  { color: PRIMARY, fontSize: 12, fontWeight: '700' },

  // Tab bar
  tabBar:          { flexDirection: 'row', backgroundColor: '#EDE8DF', marginHorizontal: 14, marginVertical: 12, borderRadius: 12, padding: 4 },
  tabBtn:          { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  tabBtnActive:    { backgroundColor: PRIMARY },
  tabBtnTxt:       { color: MUTED, fontWeight: '700', fontSize: 12 },
  tabBtnTxtActive: { color: '#fff' },

  // Scroll
  tabScroll:  { flex: 1 },
  tabContent: { padding: 16 },

  // Section title
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  sectionAccent:   { width: 4, height: 20, backgroundColor: GOLD, borderRadius: 2 },
  sectionTitle:    { color: '#1A1008', fontSize: 17, fontWeight: '800' },
  hintText:        { color: MUTED, fontSize: 12, marginBottom: 14, marginLeft: 14, lineHeight: 18 },
  loadingTxt:      { color: MUTED, fontSize: 13, marginTop: 12 },

  // Browse grid
  browseContent:  { padding: 16 },
  browseRow:      { gap: 12, marginBottom: 12 },
  browseCard:     { width: CARD_W, backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  browseImg:      { width: '100%', aspectRatio: 3/4, backgroundColor: '#F0EBE1' },
  browseBadge:    { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  browseBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  browseInfo:     { padding: 10, paddingRight: 28 },
  browseTitle:    { color: '#1A1008', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  browsePrice:    { color: PRIMARY, fontSize: 13, fontWeight: '800', marginTop: 4 },
  browseArrow:    { position: 'absolute', right: 10, bottom: 14 },
  browseArrowTxt: { color: MUTED, fontSize: 18 },

  // UID row
  uidRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  uidInput:     { flex: 1, backgroundColor: CARD_BG, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: '#1A1008' },
  uidSearchBtn: { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', minWidth: 74 },
  uidSearchTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },

  // Item detail card
  itemCard:  { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 16 },
  itemThumb: { width: '100%', height: 200, borderRadius: 10, marginBottom: 14, backgroundColor: '#F0EBE1' },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F4EFE8' },
  infoLabel: { color: MUTED, fontSize: 12, fontWeight: '600', flex: 1 },
  infoValue: { color: '#1A1008', fontSize: 13, fontWeight: '700', flex: 2, textAlign: 'right' },

  // Form card
  formCard:        { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16, marginBottom: 16 },
  formCardTitle:   { color: '#1A1008', fontSize: 14, fontWeight: '800', marginBottom: 14 },
  fieldWrap:       { marginBottom: 12 },
  fieldLabel:      { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 5, textTransform: 'uppercase' },
  fieldInput:      { backgroundColor: '#FAF7F2', borderRadius: 9, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: '#1A1008' },
  fieldInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  // Image picker
  imgPickerBtn:      { backgroundColor: '#F0EBE1', borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, borderStyle: 'dashed', paddingVertical: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  imgPickerInner:    { alignItems: 'center', gap: 6 },
  imgPickerIcon:     { fontSize: 32 },
  imgPickerTxt:      { color: '#4A3728', fontSize: 14, fontWeight: '700' },
  imgPickerSub:      { color: MUTED, fontSize: 11 },
  imgPickerUploading:{ color: PRIMARY, fontSize: 13, fontWeight: '700', marginTop: 8 },
  imgPreviewWrap:    { borderRadius: 12, overflow: 'hidden', marginBottom: 4, position: 'relative' },
  imgPreview:        { width: '100%', height: 220, backgroundColor: '#F0EBE1' },
  imgChangeBadge:    { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  imgChangeBadgeTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Action buttons
  actionRow:          { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn:          { flex: 1, borderRadius: 11, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnSmall:     { paddingVertical: 10 },
  actionBtnTxt:       { color: '#fff', fontWeight: '800', fontSize: 14 },
  actionBtnTxtSmall:  { fontSize: 12 },

  // Create hint
  createHint:    { backgroundColor: '#FFF8E6', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F0D890', marginBottom: 16 },
  createHintTxt: { color: '#7A5800', fontSize: 13, marginBottom: 12 },

  // Catalog
  catalogAddCard:  { backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 16, marginVertical: 16 },
  catalogRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 12, borderWidth: 1, borderColor: BORDER, marginBottom: 10, padding: 10, gap: 10 },
  catalogNum:      { width: 24, height: 24, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  catalogNumTxt:   { color: '#fff', fontSize: 11, fontWeight: '800' },
  catalogThumb:    { width: 52, height: 52, borderRadius: 8, backgroundColor: '#F0EBE1' },
  catalogRowInfo:  { flex: 1 },
  catalogRowTitle: { color: '#1A1008', fontSize: 13, fontWeight: '700' },
  catalogRowId:    { color: MUTED, fontSize: 11, marginTop: 2 },
  removeBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FDECEA', alignItems: 'center', justifyContent: 'center' },
  removeBtnTxt:    { color: DANGER, fontSize: 15, fontWeight: '800' },
  addBtn:          { width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  addBtnTxt:       { color: SUCCESS, fontSize: 20, fontWeight: '800', marginTop: -2 },

  // Misc
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyBox:   { padding: 32, alignItems: 'center' },
  emptyTxt:   { color: MUTED, fontSize: 14 },
});
