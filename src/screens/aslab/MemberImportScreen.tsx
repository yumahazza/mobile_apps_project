import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { BulkImportPreview } from '@/components/BulkImportPreview';
import { CustomButton } from '@/components/CustomButton';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { useApp } from '@/context/AppContext';
import type { NavigationProp } from '@/navigation/navigationTypes';
import type { BulkCommitItemOutcome, BulkImportColumn, BulkImportDraftRow, BulkRowValidator } from '@/types/bulkImport';
import { useBulkImport } from '@/hooks/useBulkImport';
import { importLaboratoryMembers } from '@/services/laboratoryMembershipService';
import { showMessage } from '@/services/dialogService';
import { APP_COLORS, APP_FONTS, APP_SPACING } from '@/constants/theme';

type MemberCsvRow = Record<string,string> & { laboratoryCode:string; email:string; nim:string };
type MemberRole = 'student' | 'asprak';
const schemas = {
 student: { file:'template_praktikan.csv', headers:['laboratoryCode','email','nim'] as const,
 columns:[
  {key:'laboratoryCode',label:'Kode Laboratorium',required:true,inputType:'code' as const},
  {key:'email',label:'Email Akun',required:true,inputType:'email' as const},
  {key:'nim',label:'NIM',required:true,inputType:'text' as const},
 ] as BulkImportColumn<MemberCsvRow>[] },
 asprak: { file:'template_asprak.csv', headers:['laboratoryCode','email'] as const,
 columns:[
  {key:'laboratoryCode',label:'Kode Laboratorium',required:true,inputType:'code' as const},
  {key:'email',label:'Email Akun',required:true,inputType:'email' as const},
 ] as BulkImportColumn<MemberCsvRow>[] },
};
const normalize = (key:keyof MemberCsvRow & string,value:string) => key === 'laboratoryCode' ? value.trim().toUpperCase() : value.trim();
const makeValidator = (role:MemberRole):BulkRowValidator<MemberCsvRow> => (row,index,all) => {
 const fieldErrors:Partial<Record<keyof MemberCsvRow,string>>={}; const messages:string[]=[];
 if(!row.laboratoryCode.trim()) fieldErrors.laboratoryCode='Kode laboratorium wajib diisi.';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) fieldErrors.email='Masukkan email yang valid.';
 if(role==='student' && !row.nim.trim()) fieldErrors.nim='NIM wajib diisi untuk Praktikan.';
 if(all.some((other,i)=>i!==index && other.email.trim().toLowerCase()===row.email.trim().toLowerCase() && other.laboratoryCode.trim().toUpperCase()===row.laboratoryCode.trim().toUpperCase())) messages.push('Email dan laboratorium terduplikasi dalam file.');
 return {valid:Object.keys(fieldErrors).length===0 && messages.length===0,fieldErrors,messages};
};
interface Props {navigation:NavigationProp}
export const MemberImportScreen:React.FC<Props> = ({navigation}) => {
 const courseId=String(navigation.params?.courseId ?? '');
 const [role,setRole]=useState<MemberRole>('student'); const schema=schemas[role]; const validator=useMemo(()=>makeValidator(role),[role]);
 const importer=useBulkImport<MemberCsvRow>({requiredHeaders:schema.headers,validateRow:validator,normalizeCell:normalize,templateFileName:schema.file,getTemplateCsvContent:()=>`${schema.headers.join(',')}\nLAB-A,akun@example.com${role==='student'?',123456789':''}\n`,idPrefix:`${role}-import`});
 const download=async()=>{const r=await importer.downloadTemplate(); if(!r.ok)showMessage('Template gagal diunduh',r.message||'');};
 const pick=async()=>{const r=await importer.pickCsvFile(); if(!r) return;};
 const confirm=async(rows:BulkImportDraftRow<MemberCsvRow>[])=>{
  if(!courseId){showMessage('Cakupan belum tersedia','Pilih mata kuliah Aslab terlebih dahulu.');return;}
  const result=await importer.runCommit(async ready=>{
   const response=await importLaboratoryMembers({courseId,memberRole:role,rows:ready.map(x=>({laboratoryCode:x.data.laboratoryCode.trim().toUpperCase(),email:x.data.email.trim().toLowerCase(),...(role==='student'?{nim:x.data.nim.trim()}:{})}))});
   return ready.map((item,i)=>{const remote=response.outcomes.find(o=>o.rowIndex===i);return {localId:item.localId,success:!!remote?.success,message:remote?.message|| (remote?.success?'Tersimpan':'Server tidak memberikan hasil untuk baris ini.')} as BulkCommitItemOutcome;});
  });
  if(result)showMessage(result.failedCount?'Impor sebagian':'Impor berhasil',`${result.succeededCount} berhasil, ${result.failedCount} gagal.`);
 };
 return <View style={styles.root}><AppHeader title="Import Anggota" subtitle="Praktikan dan Asprak diproses terpisah" onBack={()=>navigation.goBack()}/>
 <ResponsiveContainer><ScrollView contentContainerStyle={styles.content}>
 <View style={styles.tabs}>{(['student','asprak'] as const).map(r=><Pressable key={r} onPress={()=>{setRole(r);importer.reset();}} style={[styles.tab,role===r&&styles.active]}><Text style={[styles.tabText,role===r&&styles.activeText]}>{r==='student'?'Import Praktikan':'Import Asprak'}</Text></Pressable>)}</View>
 <Text style={styles.info}>Mata kuliah: {courseId||'Belum dipilih'}. File {schema.file}; kolom: {schema.headers.join(', ')}.</Text>
 <View style={styles.actions}><CustomButton title="Unduh Template CSV" onPress={download}/><CustomButton title={importer.pickingFile?'Memilih...':'Pilih File CSV'} variant="outline" onPress={pick} disabled={importer.pickingFile}/></View>
 {importer.parseError&&<Text style={styles.error}>{importer.parseError}</Text>}
 {importer.fileName&&<Text style={styles.info}>File: {importer.fileName}</Text>}
 <BulkImportPreview rows={importer.rows} columns={schema.columns} validateRow={validator} onRowChange={importer.onRowChange} onAcceptChange={importer.onAcceptChange} onConfirm={confirm} summary={importer.summary} lastCommitResult={importer.lastCommitResult} submitting={importer.submitting} confirmDisabled={!courseId}/>
 </ScrollView></ResponsiveContainer></View>;
};
const styles=StyleSheet.create({root:{flex:1,backgroundColor:APP_COLORS.background},content:{padding:APP_SPACING.lg,gap:14,paddingBottom:40},tabs:{flexDirection:'row',gap:8},tab:{flex:1,padding:12,borderRadius:12,backgroundColor:APP_COLORS.surface,alignItems:'center'},active:{backgroundColor:APP_COLORS.primary},tabText:{color:APP_COLORS.textPrimary,fontFamily:APP_FONTS.medium},activeText:{color:'#fff'},info:{color:APP_COLORS.textSecondary,fontSize:12},actions:{gap:8},error:{color:APP_COLORS.dangerText}});
