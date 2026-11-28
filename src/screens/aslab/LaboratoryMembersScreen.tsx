import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { CustomButton } from '@/components/CustomButton';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useApp } from '@/context/AppContext';
import type { NavigationProp } from '@/navigation/navigationTypes';
import { listLaboratoryMemberships, listScopedLaboratories, searchMembershipCandidates, assignLaboratoryMember, transferLaboratoryMember } from '@/services/laboratoryMembershipService';
import type { LaboratoryMembership, MembershipCandidate, LaboratoryMemberRole } from '@/types/laboratoryMembership';
import type { Laboratory } from '@/types/laboratory';
import { showMessage } from '@/services/dialogService';
import { APP_COLORS, APP_FONTS, APP_RADIUS, APP_SPACING } from '@/constants/theme';

interface Props { navigation: NavigationProp }
export const LaboratoryMembersScreen: React.FC<Props> = ({ navigation }) => {
  const { activeUser } = useApp();
  const courseId = String(navigation.params?.courseId ?? '');
  const [labs, setLabs] = useState<Laboratory[]>([]);
  const [labId, setLabId] = useState(String(navigation.params?.laboratoryId ?? ''));
  const [role, setRole] = useState<LaboratoryMemberRole>('student');
  const [rows, setRows] = useState<LaboratoryMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<MembershipCandidate[]>([]);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferTarget, setTransferTarget] = useState<LaboratoryMembership | null>(null);
  const [destinationId, setDestinationId] = useState('');

  useEffect(() => { if (!courseId) { setLabs([]); return; } let alive = true; void listScopedLaboratories(courseId).then(value => { if (alive) setLabs(value); }).catch(e => showMessage('Gagal memuat laboratorium', e instanceof Error ? e.message : 'Coba lagi.')); return () => { alive = false; }; }, [courseId]);
  const load = useCallback(async () => {
    if (!courseId || !labId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try { setRows(await listLaboratoryMemberships({ courseId, laboratoryId: labId, role })); }
    catch (e) { showMessage('Gagal memuat anggota', e instanceof Error ? e.message : 'Coba lagi.'); }
    finally { setLoading(false); }
  }, [courseId, labId, role]);
  useEffect(() => { void load(); }, [load]);

  const search = useCallback(async (value: string) => {
    setQuery(value);
    if (value.trim().length < 2 || !courseId) { setCandidates([]); return; }
    try { setCandidates(await searchMembershipCandidates({ courseId, query: value, role })); }
    catch (e) { showMessage('Pencarian gagal', e instanceof Error ? e.message : 'Coba lagi.'); }
  }, [courseId, role]);

  const add = async (candidate: MembershipCandidate) => {
    setBusy(true);
    try {
      await assignLaboratoryMember({ courseId, laboratoryId: labId, memberUid: candidate.uid, memberRole: role });
      setModal(false); setQuery(''); setCandidates([]); await load();
      showMessage('Berhasil', `${candidate.displayName} ditambahkan ke laboratorium.`);
    } catch (e) { showMessage('Tidak dapat menambahkan anggota', e instanceof Error ? e.message : 'Periksa data akun.'); }
    finally { setBusy(false); }
  };

  const transfer = async () => {
    if (!transferTarget || !destinationId || destinationId === transferTarget.laboratoryId) return;
    setBusy(true);
    try {
      await transferLaboratoryMember({ membershipId: transferTarget.id, toLaboratoryId: destinationId, expectedFromLaboratoryId: transferTarget.laboratoryId });
      setTransferTarget(null); setDestinationId(''); await load();
      showMessage('Perpindahan berhasil', 'Membership diperbarui. Jadwal dan riwayat lama tidak dipindahkan.');
    } catch (e) { showMessage('Perpindahan gagal', e instanceof Error ? e.message : 'Coba lagi.'); }
    finally { setBusy(false); }
  };

  const title = role === 'student' ? 'Praktikan' : 'Asprak';
  return <View style={styles.root}>
    <AppHeader title="Anggota Laboratorium" subtitle="Distribusi Praktikan dan Asprak" onBack={() => navigation.goBack()} />
    <ResponsiveContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Laboratorium</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {labs.map(l => <Pressable key={l.id} onPress={() => setLabId(l.id)} style={[styles.chip, labId === l.id && styles.chipActive]}><Text style={[styles.chipText, labId === l.id && styles.chipTextActive]}>{l.name}</Text></Pressable>)}
        </ScrollView>
        <View style={styles.tabs}>
          {(['student','asprak'] as const).map(r => <Pressable key={r} onPress={() => setRole(r)} style={[styles.tab, role === r && styles.tabActive]}><Text style={[styles.tabText, role === r && styles.tabTextActive]}>{r === 'student' ? 'Praktikan' : 'Asprak'}</Text></Pressable>)}
        </View>
        <View style={styles.rowBetween}><Text style={styles.heading}>Daftar {title}</Text><CustomButton title={`+ Tambah ${role === 'student' ? 'Praktikan' : 'Asprak'}`} onPress={() => setModal(true)} size="sm" /></View>
        {!courseId && <Text style={styles.error}>Cakupan mata kuliah Aslab belum tersedia. Hubungkan courseId dari profil/route.</Text>}
        {loading ? <ActivityIndicator color={APP_COLORS.primary} /> : rows.length === 0 ? <Text style={styles.muted}>Belum ada {title.toLowerCase()} pada laboratorium ini.</Text> :
          rows.map(item => <View key={item.id} style={styles.memberCard}>
            <View style={{flex:1}}><Text style={styles.memberName}>{item.displayName || item.email}</Text><Text style={styles.muted}>{item.nim ? `${item.nim} · ` : ''}{item.email}</Text><Text style={styles.status}>{item.status === 'active' ? 'Aktif' : item.status}</Text></View>
            <Pressable onPress={() => setTransferTarget(item)} style={styles.action}><Ionicons name="swap-horizontal" size={19} color={APP_COLORS.primary}/><Text style={styles.actionText}>Pindah</Text></Pressable>
          </View>)}
      </ScrollView>
    </ResponsiveContainer>
    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
      <View style={styles.overlay}><View style={styles.modal}>
        <Text style={styles.heading}>Tambah {title}</Text>
        <Text style={styles.muted}>Cari akun yang sudah terdaftar menggunakan email atau NIM. Akun baru tidak dibuat dari halaman ini.</Text>
        <TextInput value={query} onChangeText={search} placeholder="Ketik email atau NIM (min. 2 karakter)" style={styles.input} autoCapitalize="none"/>
        {candidates.map(c => <Pressable key={c.uid} disabled={busy} onPress={() => void add(c)} style={styles.candidate}><Text style={styles.memberName}>{c.displayName}</Text><Text style={styles.muted}>{c.email}{c.nim ? ` · ${c.nim}` : ''}</Text></Pressable>)}
        {query.trim().length >= 2 && candidates.length === 0 && <Text style={styles.muted}>Tidak ada akun yang cocok atau role tidak sesuai.</Text>}
        <CustomButton title="Tutup" variant="outline" onPress={() => setModal(false)} />
      </View></View>
    </Modal>
    <Modal visible={!!transferTarget} transparent animationType="fade" onRequestClose={() => setTransferTarget(null)}>
      <View style={styles.overlay}><View style={styles.modal}>
        <Text style={styles.heading}>Pindahkan Anggota</Text><Text style={styles.muted}>{transferTarget?.displayName} · {transferTarget?.laboratoryCode}</Text>
        {labs.filter(l => l.id !== transferTarget?.laboratoryId).map(l => <Pressable key={l.id} onPress={() => setDestinationId(l.id)} style={[styles.candidate, destinationId === l.id && styles.chipActive]}><Text style={styles.memberName}>{l.name}</Text></Pressable>)}
        <CustomButton title={busy ? 'Memproses...' : 'Konfirmasi Pindah'} onPress={() => void transfer()} disabled={busy || !destinationId}/>
        <CustomButton title="Batal" variant="outline" onPress={() => setTransferTarget(null)} />
      </View></View>
    </Modal>
  </View>;
};
const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:APP_COLORS.background},content:{padding:APP_SPACING.lg,gap:14,paddingBottom:40},label:{fontFamily:APP_FONTS.semiBold,color:APP_COLORS.textPrimary},chip:{paddingHorizontal:14,paddingVertical:9,borderRadius:30,backgroundColor:APP_COLORS.surface,marginRight:8,borderWidth:1,borderColor:APP_COLORS.border},chipActive:{backgroundColor:APP_COLORS.primary,borderColor:APP_COLORS.primary},chipText:{color:APP_COLORS.textPrimary,fontFamily:APP_FONTS.medium},chipTextActive:{color:'#fff'},tabs:{flexDirection:'row',backgroundColor:APP_COLORS.surface,padding:4,borderRadius:12},tab:{flex:1,padding:10,alignItems:'center',borderRadius:9},tabActive:{backgroundColor:APP_COLORS.primary},tabText:{color:APP_COLORS.textPrimary,fontFamily:APP_FONTS.medium},tabTextActive:{color:'#fff'},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},heading:{fontFamily:APP_FONTS.bold,fontSize:18,color:APP_COLORS.textPrimary},memberCard:{flexDirection:'row',alignItems:'center',padding:14,borderRadius:14,backgroundColor:APP_COLORS.surface,borderWidth:1,borderColor:APP_COLORS.border,gap:10},memberName:{fontFamily:APP_FONTS.semiBold,color:APP_COLORS.textPrimary},muted:{fontFamily:APP_FONTS.regular,color:APP_COLORS.textSecondary,fontSize:12,marginTop:3},status:{color:APP_COLORS.success,fontSize:11,marginTop:5},action:{alignItems:'center',padding:8},actionText:{fontSize:11,color:APP_COLORS.primary},error:{color:APP_COLORS.dangerText},overlay:{flex:1,backgroundColor:'#0008',justifyContent:'center',padding:20},modal:{backgroundColor:APP_COLORS.background,borderRadius:18,padding:18,gap:12,maxHeight:'85%'},input:{borderWidth:1,borderColor:APP_COLORS.border,borderRadius:10,padding:12,color:APP_COLORS.textPrimary},candidate:{padding:12,borderWidth:1,borderColor:APP_COLORS.border,borderRadius:10},});
