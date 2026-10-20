import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, BarChart3, CalendarDays, RefreshCw, Clock3, Wallet, CircleCheck, CircleX, Ban, TrendingUp, ClipboardList, Package, PhilippinePeso, ShieldCheck, RotateCcw, AlertCircle, CalendarRange, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatReportMoney, loadCatererReport, reportError, reportRange, validateReportRange, type CatererReport, type ReportPreset, type ReportRange } from '../../lib/catererReports';
const PRESETS: ReportPreset[] = ['This Month','Last Month','This Year','Custom Date Range'];
const EXPECTED_DEFINITION = 'Combined value of confirmed, awaiting-payment, paid, ongoing and completed bookings placed during the selected period. This amount represents the value of accepted bookings, not payments received.';
const EVIDENCE_DEFINITION = 'Total downpayments recorded as confirmed during the selected period for bookings marked paid, ongoing or completed. Based on the amount required for each booking; remaining balances are excluded.';
// The existing database has no independent booking-payment ledger. This read-only
// calculation reflects recorded verification fields, not confirmed cash settlement.
function amountToCentavos(value: unknown): number {
  const text = String(value ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid stored downpayment amount.');
  const [whole, frac = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Invalid stored downpayment amount.');
  return cents;
}
async function loadRecordedDownpayments(catererId: string, range: ReportRange): Promise<string> {
  // Philippine local dates. Inclusive start, exclusive next day.
  const start = new Date(`${range.start}T00:00:00+08:00`);
  const end = new Date(new Date(`${range.end}T00:00:00+08:00`).getTime() + 86400000);
  let totalCents = 0;
  let offset = 0;
  const pageSize = 500;
  for (;;) {
    const { data, error } = await supabase.from('bookings')
      .select('id,downpayment_amount')
      .eq('caterer_id', catererId)
      .in('status', ['paid', 'ongoing', 'completed'])
      .not('payment_reference', 'is', null)
      .gte('payment_verified_at', start.toISOString())
      .lt('payment_verified_at', end.toISOString())
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error('Downpayment records are unavailable.');
    for (const item of data) {
      totalCents += amountToCentavos(item.downpayment_amount);
      if (!Number.isSafeInteger(totalCents)) throw new Error('Downpayment total is too large.');
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return (totalCents / 100).toFixed(2);
}
export default function CatererReports() {
  const router=useRouter(),insets=useSafeAreaInsets();
  const {session,profile,catererData}=useAuth();
  const [preset,setPreset]=useState<ReportPreset>('This Month');
  const [range,setRange]=useState<ReportRange>(()=>reportRange('This Month'));
  const [draft,setDraft]=useState<ReportRange>(range);
  const [dateError,setDateError]=useState('');
  const identity=`${session?.user.id ?? ''}:${catererData?.id ?? ''}:${profile?.role ?? ''}:${range.start}:${range.end}`;
  const current=useRef(identity);current.current=identity;
  const version=useRef(0);
  const [state,setState]=useState<{identity:string;report:CatererReport|null;recordedDownpayments:string|null;loading:boolean;error:string}>({identity:'',report:null,recordedDownpayments:null,loading:true,error:''});
  const refresh=useCallback(async()=>{
    if(preset!=='Custom Date Range') {
      const fresh=reportRange(preset);
      if(fresh.start!==range.start || fresh.end!==range.end) {setRange(fresh);setDraft(fresh);return;}
    }
    const request=++version.current;
    setState({identity,report:null,recordedDownpayments:null,loading:true,error:''});
    try {
      if (!session?.user.id || profile?.role!=='caterer' || !catererData?.id) throw new Error('Sign in with your caterer account to view reports.');
      const [report, recordedDownpayments] = await Promise.all([
        loadCatererReport(range), loadRecordedDownpayments(catererData.id, range),
      ]);
      if(current.current===identity && version.current===request) setState({identity,report,recordedDownpayments,loading:false,error:''});
    } catch(error) {
      if(current.current===identity && version.current===request) setState({identity,report:null,recordedDownpayments:null,loading:false,error:reportError(error)});
    }
  },[identity,range,preset,session?.user.id,profile?.role,catererData?.id]);
  useFocusEffect(useCallback(()=>{
    // Focus and pull-to-refresh both re-evaluate Manila calendar presets.
    void refresh();return()=>{version.current++;};
  },[refresh]));
  const choose=(value:ReportPreset)=>{
    setPreset(value);setDateError('');
    if(value!=='Custom Date Range'){const next=reportRange(value);setRange(next);setDraft(next);}
    else setDraft(range);
  };
  const apply=()=>{
    try{validateReportRange(draft);setRange({...draft});setDateError('');}
    catch(error){setDateError(reportError(error));}
  };
  const active=state.identity===identity?state:null;
  const data=active?.report;
  // Show exactly five consecutive calendar months ending at the report end month.
  // Months without records display zero; report queries and filters are unchanged.
  const chartMonths = (() => {
    if (!data) return [];
    const existing = new Map(data.months.map(month => [month.month.slice(0, 7), month.count]));
    const endMonth = range.end.slice(0, 7);
    const result: { month: string; count: number }[] = [];
    for (let offset = 4; offset >= 0; offset--) {
      const date = new Date(`${endMonth}-01T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() - offset);
      const key = date.toISOString().slice(0, 7);
      result.push({ month: `${key}-01`, count: existing.get(key) ?? 0 });
    }
    return result;
  })();
  const maxMonth=Math.max(1,...chartMonths.map(m=>m.count));
  const statusCards = data ? [
    { label: 'Pending', value: data.statuses.pending, Icon: Clock3, tone: '#A16207', bg: '#FEF3C7' },
    { label: 'Confirmed / awaiting payment', value: data.statuses.confirmed + data.statuses.awaiting_payment, Icon: ClipboardList, tone: '#9A3412', bg: '#FFEDD5' },
    { label: 'Paid / ongoing', value: data.statuses.paid + data.statuses.ongoing, Icon: Wallet, tone: '#047857', bg: '#D1FAE5' },
    { label: 'Completed', value: data.statuses.completed, Icon: CircleCheck, tone: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'Rejected', value: data.statuses.rejected, Icon: CircleX, tone: '#B91C1C', bg: '#FEE2E2' },
    { label: 'Cancelled', value: data.statuses.cancelled, Icon: Ban, tone: '#64748B', bg: '#F1F5F9' },
  ] : [];
  const acceptedCount = data ? data.statuses.confirmed + data.statuses.awaiting_payment + data.statuses.paid + data.statuses.ongoing + data.statuses.completed : 0;
  const acceptedPercent = data && data.total > 0 ? Math.round(acceptedCount / data.total * 100) : 0;
  return <View style={styles.screen}>
    <View style={[styles.header,{paddingTop:insets.top+12}]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to caterer dashboard" style={styles.back} activeOpacity={0.7} onPress={()=>router.replace('/(caterer)')}><ChevronLeft size={24} color="#A64200" /></TouchableOpacity>
      <View style={styles.headerCopy}><Text accessibilityRole="header" style={styles.title}>Reports & Analytics</Text><Text style={styles.subtitle}>An overview of booking performance and financial activity</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh reports" disabled={active?.loading} style={styles.iconButton} onPress={()=>void refresh()}><RefreshCw size={19} color="#A64200" /></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+28}]}
      refreshControl={<RefreshControl refreshing={!!active?.loading} onRefresh={()=>void refresh()} tintColor="#FF7A00" />}>
      <View style={styles.periodCard}>
        <View style={styles.periodHeading}>
          <View style={styles.periodIcon}><CalendarRange size={21} color="#C65000" /></View>
          <View style={{flex:1}}><Text style={styles.sectionTitle}>Report period</Text><Text style={styles.hint}>Explore performance over time</Text></View>
          <View style={styles.periodBadge}><Text style={styles.periodBadgeText}>PHT</Text></View>
        </View>
        <View style={styles.presetGrid}>{PRESETS.map(value=><TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{selected:preset===value}}
          style={[styles.preset,preset===value&&styles.presetSelected]} onPress={()=>choose(value)}>
          <Text style={[styles.presetText,preset===value&&styles.presetSelectedText]}>{value}</Text>
        </TouchableOpacity>)}</View>
        {preset==='Custom Date Range'&&<>
          <View style={styles.dateRow}>{(['start','end'] as const).map(key=><View key={key} style={styles.dateField}>
            <Text style={styles.label}>{key==='start'?'Start date':'End date (inclusive)'}</Text>
            <TextInput accessibilityLabel={`Report ${key} date, YYYY-MM-DD`} style={styles.dateInput} value={draft[key]} placeholder="YYYY-MM-DD"
              autoCapitalize="none" autoCorrect={false} maxLength={10} onChangeText={value=>setDraft(prev=>({...prev,[key]:value}))} />
          </View>)}</View>
          <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={apply}><Text style={styles.primaryText}>Apply Date Range</Text></TouchableOpacity>
          <Text style={styles.hint}>Select a period of up to 366 days using the YYYY-MM-DD date format.</Text>
        </>}
        {!!dateError&&<Text accessibilityRole="alert" style={styles.error}>{dateError}</Text>}
        <View style={styles.periodDatePill}><CalendarDays size={15} color="#C65000" /><Text style={styles.period}>{range.start}  —  {range.end}</Text></View>
        <Text style={styles.hint}>Reporting periods follow Philippine Standard Time. Booking statistics use the date each booking was placed; downpayments use the recorded payment confirmation date.</Text>
      </View>
      {!active||active.loading?<View style={styles.state}><ActivityIndicator color="#FF7A00" size="large" /><Text style={styles.body}>Loading your report…</Text></View>
        :active.error?<View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{active.error}</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.primary} onPress={()=>void refresh()}><Text style={styles.primaryText}>Retry</Text></TouchableOpacity></View>
        :data&&<>
          {data.total===0&&<View style={styles.card}><BarChart3 size={28} color="#A64200" /><Text style={styles.sectionTitle}>No bookings in this period</Text><Text style={styles.body}>No bookings were placed during this period. Select another date range to review booking activity.</Text></View>}
          {!!data.undated_bookings&&<Text style={styles.hint}>{data.undated_bookings} booking(s) have no recorded booking date and are excluded from date-based statistics.</Text>}
          <View style={styles.statsTitleRow}>
            <View style={styles.statsHeaderIcon}><BarChart3 size={21} color="#A64200" /></View>
            <View style={{flex:1}}>
              <Text accessibilityRole="header" style={styles.heading}>Booking statistics</Text>
              <Text style={styles.hint}>Bookings placed during the selected period, grouped by current status.</Text>
            </View>
          </View>
          <View style={styles.featuredStat}>
            <View style={styles.featuredStatTop}>
              <View style={styles.featuredIcon}><ClipboardList size={23} color="#FFFFFF" /></View>
              <View style={styles.featuredPill}><TrendingUp size={14} color="#FFF7ED" /><Text style={styles.featuredPillText}>Booking overview</Text></View>
            </View>
            <Text style={styles.featuredNumber}>{data.total.toLocaleString()}</Text>
            <Text style={styles.featuredLabel}>Total bookings</Text>
            <View style={styles.featuredDivider} />
            <View style={styles.featuredBottom}>
              <View><Text style={styles.featuredSmallValue}>{acceptedCount.toLocaleString()}</Text><Text style={styles.featuredSmallLabel}>Accepted bookings</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={styles.featuredSmallValue}>{acceptedPercent}%</Text><Text style={styles.featuredSmallLabel}>Of all bookings</Text></View>
            </View>
            <View style={styles.featuredProgress}><View style={[styles.featuredProgressFill, { width: `${acceptedPercent}%` }]} /></View>
          </View>
          <View style={styles.statusGrid}>{statusCards.map(({ label, value, Icon, tone, bg }) => (
            <View key={label} style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: bg }]}><Icon size={19} color={tone} /></View>
              <Text style={styles.statusCount}>{value.toLocaleString()}</Text>
              <Text style={styles.statusLabel}>{label}</Text>
              <View style={styles.statusTrack}><View style={[styles.statusFill, { width: `${data.total > 0 ? value / data.total * 100 : 0}%`, backgroundColor: tone }]} /></View>
            </View>
          ))}</View>
          <View style={styles.visualCard}>
            <View style={styles.sectionRow}>
              <View style={styles.sectionIconOrange}><TrendingUp size={20} color="#C65000" /></View>
              <View style={{flex:1}}><Text accessibilityRole="header" style={styles.sectionTitle}>Monthly booking trends</Text><Text style={styles.hint}>Booking activity by creation month</Text></View>
            </View>
            <Text style={styles.body}>Compare the number of bookings placed during each month, regardless of their status.</Text>
            <View style={styles.chartNew}>
              {chartMonths.map(month => <View key={month.month} accessible accessibilityLabel={`${month.month.slice(0,7)}: ${month.count} bookings`} style={styles.chartColumnNew}>
                <Text style={styles.chartValueNew}>{month.count}</Text>
                <View style={styles.chartTrackNew}><View style={[styles.chartBarNew,{height:`${month.count/maxMonth*100}%`,backgroundColor:month.count===maxMonth && month.count>0?'#E96808':'#FDBA74'}]} /></View>
                <Text style={styles.chartLabelNew}>{new Date(month.month+'T00:00:00Z').toLocaleDateString('en-PH',{month:'short',timeZone:'Asia/Manila'})}</Text>
                <Text style={styles.chartYear}>{month.month.slice(0,4)}</Text>
              </View>)}
            </View>
            <View style={styles.chartLegend}><View style={styles.legendDot}/><Text style={styles.hint}>Monthly bookings · Philippine Standard Time</Text></View>
          </View>
          <View style={styles.visualCard}>
            <View style={styles.sectionRow}>
              <View style={styles.sectionIconOrange}><Package size={20} color="#C65000" /></View>
              <View style={{flex:1}}><Text accessibilityRole="header" style={styles.sectionTitle}>Popular packages</Text><Text style={styles.hint}>Your most frequently booked offers</Text></View>
            </View>
            <Text style={styles.body}>Rankings include bookings of all statuses, including packages no longer available for new bookings.</Text>
            {!data.packages.length ? <View style={styles.emptyPanel}><Package size={28} color="#FDBA74" /><Text style={styles.emptyPanelText}>No package bookings for this period</Text></View>
            : data.packages.map((pkg,index)=><View key={`${pkg.id??'missing'}-${index}`} style={styles.packageRow}>
                <View style={[styles.rankCircle,index===0&&styles.rankCircleFirst]}><Text style={[styles.rankCircleText,index===0&&styles.rankCircleTextFirst]}>{index+1}</Text></View>
                <View style={{flex:1}}><Text style={styles.packageNameNew} numberOfLines={2}>{pkg.name}</Text><Text style={styles.packageCaption}>{pkg.count} {pkg.count===1?'booking':'bookings'}</Text></View>
                <View style={styles.packageProgressTrack}><View style={[styles.packageProgressFill,{width:`${data.packages[0]?.count ? pkg.count/data.packages[0].count*100 : 0}%`}]} /></View>
              </View>)}
          </View>
          <View style={styles.sectionRow}>
            <View style={styles.sectionIconOrange}><PhilippinePeso size={20} color="#C65000" /></View>
            <View style={{flex:1}}><Text accessibilityRole="header" style={styles.heading}>Financial analytics</Text><Text style={styles.hint}>Booking value, downpayments and refund activity</Text></View>
          </View>
          <View style={styles.financeGrid}>
            <View style={[styles.financeCard,styles.financeCardWarm]}>
              <View style={styles.financeHead}><View style={styles.financeIconWarm}><PhilippinePeso size={20} color="#C65000" /></View><Text style={styles.financeKicker}>BOOKING VALUE</Text></View>
              <Text style={styles.financeLabel}>Estimated booking value</Text>
              <Text style={styles.financeMoney} adjustsFontSizeToFit numberOfLines={1}>{formatReportMoney(data.expected_value)}</Text>
              <View style={styles.financeRule}/><Text style={styles.financeDescription}>{EXPECTED_DEFINITION}</Text>
            </View>
            <View style={[styles.financeCard,styles.financeCardGreen]}>
              <View style={styles.financeHead}><View style={styles.financeIconGreen}><ShieldCheck size={20} color="#047857" /></View><Text style={[styles.financeKicker,{color:'#047857'}]}>DOWNPAYMENTS</Text></View>
              <Text style={styles.financeLabel}>Verified Downpayments Received</Text>
              <Text style={styles.financeMoney} adjustsFontSizeToFit numberOfLines={1}>{formatReportMoney(active?.recordedDownpayments ?? null)}</Text>
              <View style={styles.financeRule}/><Text style={styles.financeDescription}>{EVIDENCE_DEFINITION}</Text>
            </View>
          </View>
          <View style={styles.visualCard}>
            <View style={styles.sectionRow}><View style={styles.sectionIconGrey}><RotateCcw size={20} color="#64748B" /></View><View style={{flex:1}}><Text style={styles.sectionTitle}>Settled refunds</Text><Text style={styles.hint}>Completed customer refunds</Text></View></View>
            <View style={styles.refundUnavailable}><AlertCircle size={17} color="#64748B"/><Text style={styles.refundUnavailableText}>Amount currently unavailable</Text></View>
            <Text style={styles.body}>The total value of refunds confirmed as returned to customers is not currently available. Outstanding refund obligations are reported separately.</Text>
          </View>
          <View style={styles.visualCard}>
            <View style={styles.sectionRow}><View style={styles.sectionIconOrange}><Wallet size={20} color="#C65000" /></View><View style={{flex:1}}><Text style={styles.sectionTitle}>Recorded refund obligations</Text><Text style={styles.hint}>Refunds awaiting completion</Text></View></View>
            <Text style={styles.refundValue}>{formatReportMoney(data.refund_obligations)}</Text>
            <View style={styles.refundMiniGrid}>
              <View style={styles.refundMini}><Text style={styles.refundMiniCount}>{data.refund_obligation_count}</Text><Text style={styles.refundMiniLabel}>Outstanding refunds</Text></View>
              <View style={styles.refundMini}><Text style={styles.refundMiniCount}>{data.open_refund_disputes}</Text><Text style={styles.refundMiniLabel}>Open / reviewing disputes</Text></View>
            </View>
            <Text style={styles.body}>Refund obligations represent amounts awaiting completion, not refunds already paid. Disputed bookings may overlap with these obligations and should not be added to the total.</Text>
          </View>
          <Text style={styles.hint}>Booking statistics, estimated booking value and refund obligations are based on bookings placed during the selected period. Downpayments are based on recorded confirmation dates. These figures do not represent net earnings or independently audited cash receipts.</Text>
        </>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F8FAFC'},header:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,paddingBottom:16,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#E2E8F0'},
  headerCopy:{flex:1},title:{fontSize:21,fontWeight:'800',color:'#0F172A',letterSpacing:-0.5},subtitle:{fontSize:12,color:'#64748B',marginTop:4},iconButton:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},back:{padding:8,borderRadius:12,backgroundColor:'#FFF7ED'},
  content:{padding:20,gap:16,width:'100%',maxWidth:760,alignSelf:'center'},card:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:18,padding:18,gap:12},row:{flexDirection:'row',alignItems:'center',gap:8},
  sectionTitle:{fontSize:16,fontWeight:'700',color:'#0F172A'},heading:{fontSize:20,fontWeight:'700',color:'#0F172A',marginTop:4},body:{fontSize:13,lineHeight:21,color:'#475569'},hint:{fontSize:12,lineHeight:19,color:'#64748B'},label:{fontSize:13,lineHeight:20,fontWeight:'600',color:'#475569'},
  presetGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},preset:{flexGrow:1,flexBasis:'44%',minHeight:46,padding:10,borderRadius:11,borderWidth:1,borderColor:'#E2E8F0',alignItems:'center',justifyContent:'center'},presetSelected:{backgroundColor:'#FFF7ED',borderColor:'#FF7A00'},presetText:{fontSize:12,fontWeight:'600',color:'#475569',textAlign:'center'},presetSelectedText:{color:'#A64200'},
  dateRow:{flexDirection:'row',flexWrap:'wrap',gap:12},dateField:{flexGrow:1,flexBasis:130,gap:6},dateInput:{minHeight:48,borderWidth:1,borderColor:'#CBD5E1',borderRadius:10,padding:12,color:'#0F172A',fontSize:14},
  primary:{backgroundColor:'#FF7A00',borderRadius:12,minHeight:46,alignItems:'center',justifyContent:'center',padding:12},primaryText:{color:'#FFFFFF',fontSize:14,fontWeight:'700'},period:{fontSize:14,fontWeight:'700',color:'#0F172A'},error:{color:'#B91C1C',fontSize:13,lineHeight:20},
  state:{padding:32,alignItems:'center',gap:16},grid:{flexDirection:'row',flexWrap:'wrap',gap:12},statCard:{flexGrow:1,flexBasis:'44%',minWidth:125,padding:16,gap:8,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:16},statValue:{fontSize:29,fontWeight:'800',color:'#0F172A'},
  chart:{gap:12,paddingVertical:12},chartColumn:{width:48,alignItems:'center',gap:6},barTrack:{width:26,height:100,backgroundColor:'#F1F5F9',borderRadius:6,justifyContent:'flex-end',overflow:'hidden'},bar:{width:'100%',backgroundColor:'#FF7A00',borderRadius:6},chartValue:{fontSize:12,fontWeight:'700',color:'#0F172A'},chartLabel:{fontSize:11,color:'#475569'},chartYear:{fontSize:10,color:'#64748B'},
  statsTitleRow:{flexDirection:'row',alignItems:'center',gap:12,marginTop:4},
  statsHeaderIcon:{width:44,height:44,borderRadius:14,backgroundColor:'#FFF7ED',justifyContent:'center',alignItems:'center'},
  featuredStat:{borderRadius:24,backgroundColor:'#C65000',padding:22,gap:6,overflow:'hidden'},
  featuredStatTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},
  featuredIcon:{width:46,height:46,borderRadius:15,backgroundColor:'rgba(255,255,255,0.20)',alignItems:'center',justifyContent:'center'},
  featuredPill:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:7,backgroundColor:'rgba(255,255,255,0.14)',borderRadius:30},
  featuredPillText:{fontSize:11,color:'#FFFFFF',fontWeight:'700'},
  featuredNumber:{fontSize:48,fontWeight:'900',color:'#FFFFFF',letterSpacing:-1.5},
  featuredLabel:{fontSize:14,color:'#FFEDD5',fontWeight:'600'},
  featuredDivider:{height:1,backgroundColor:'rgba(255,255,255,0.25)',marginVertical:14},
  featuredBottom:{flexDirection:'row',justifyContent:'space-between',marginBottom:10},
  featuredSmallValue:{fontSize:21,color:'#FFFFFF',fontWeight:'800'},
  featuredSmallLabel:{fontSize:11,color:'#FFEDD5',marginTop:3},
  featuredProgress:{height:7,backgroundColor:'rgba(255,255,255,0.25)',borderRadius:10,overflow:'hidden'},
  featuredProgressFill:{height:'100%',borderRadius:10,backgroundColor:'#FFFFFF'},
  statusGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},
  statusCard:{width:'47.8%',flexGrow:1,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:19,padding:16,minHeight:158},
  statusIcon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',marginBottom:11},
  statusCount:{fontSize:29,fontWeight:'800',color:'#0F172A',marginBottom:4},
  statusLabel:{fontSize:12,color:'#475569',fontWeight:'600',lineHeight:17,minHeight:34},
  statusTrack:{height:5,backgroundColor:'#F1F5F9',borderRadius:6,overflow:'hidden',marginTop:12},
  statusFill:{height:'100%',borderRadius:6},
  ranking:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderTopWidth:1,borderTopColor:'#F1F5F9'},rank:{width:24,color:'#A64200',fontSize:16,fontWeight:'700'},packageName:{flex:1,color:'#0F172A',fontSize:14,lineHeight:21},rankCount:{fontSize:12,color:'#475569',maxWidth:100},money:{fontSize:26,fontWeight:'800',color:'#0F172A'},unavailable:{fontSize:24,fontWeight:'700',color:'#64748B'},
  periodCard:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:22,padding:18,gap:14},
  periodHeading:{flexDirection:'row',alignItems:'center',gap:12},
  periodIcon:{height:44,width:44,borderRadius:14,backgroundColor:'#FFF1E6',alignItems:'center',justifyContent:'center'},
  periodBadge:{backgroundColor:'#F1F5F9',borderRadius:50,paddingVertical:6,paddingHorizontal:10},
  periodBadgeText:{color:'#64748B',fontSize:11,fontWeight:'800'},
  periodDatePill:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFF7ED',borderRadius:12,padding:12},
  visualCard:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E2E8F0',borderRadius:22,padding:18,gap:15},
  sectionRow:{flexDirection:'row',alignItems:'center',gap:12},
  sectionIconOrange:{height:42,width:42,borderRadius:13,backgroundColor:'#FFF1E6',alignItems:'center',justifyContent:'center'},
  sectionIconGrey:{height:42,width:42,borderRadius:13,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center'},
  chartNew:{flexDirection:'row',justifyContent:'space-between',gap:6,paddingTop:8,paddingBottom:4,width:'100%'},
  chartColumnNew:{flex:1,minWidth:0,alignItems:'center',gap:7},
  chartValueNew:{fontSize:12,fontWeight:'800',color:'#334155'},
  chartTrackNew:{width:29,height:128,backgroundColor:'#FFF7ED',borderRadius:10,overflow:'hidden',justifyContent:'flex-end'},
  chartBarNew:{width:'100%',borderRadius:9,minHeight:0},
  chartLabelNew:{fontSize:12,fontWeight:'700',color:'#475569'},
  chartLegend:{flexDirection:'row',alignItems:'center',gap:7,paddingTop:5},
  legendDot:{width:9,height:9,borderRadius:5,backgroundColor:'#E96808'},
  emptyPanel:{backgroundColor:'#FFF9F4',borderRadius:14,alignItems:'center',paddingVertical:24,gap:10},
  emptyPanelText:{fontSize:13,color:'#64748B',fontWeight:'600'},
  packageRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderTopWidth:1,borderTopColor:'#F1F5F9'},
  rankCircle:{width:34,height:34,borderRadius:12,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center'},
  rankCircleFirst:{backgroundColor:'#FFEDD5'},
  rankCircleText:{fontSize:14,fontWeight:'800',color:'#64748B'},
  rankCircleTextFirst:{color:'#C65000'},
  packageNameNew:{fontSize:13,fontWeight:'700',color:'#0F172A'},
  packageCaption:{fontSize:11,color:'#64748B',marginTop:4},
  packageProgressTrack:{width:58,height:6,backgroundColor:'#FFEDD5',borderRadius:6,overflow:'hidden'},
  packageProgressFill:{height:'100%',borderRadius:6,backgroundColor:'#F97316'},
  financeGrid:{gap:12},
  financeCard:{padding:20,borderRadius:22,borderWidth:1,gap:12},
  financeCardWarm:{backgroundColor:'#FFF7ED',borderColor:'#FED7AA'},
  financeCardGreen:{backgroundColor:'#ECFDF5',borderColor:'#A7F3D0'},
  financeHead:{flexDirection:'row',alignItems:'center',gap:10},
  financeIconWarm:{width:40,height:40,borderRadius:12,backgroundColor:'#FFEDD5',alignItems:'center',justifyContent:'center'},
  financeIconGreen:{width:40,height:40,borderRadius:12,backgroundColor:'#D1FAE5',alignItems:'center',justifyContent:'center'},
  financeKicker:{fontSize:10,fontWeight:'900',letterSpacing:1,color:'#C65000'},
  financeLabel:{fontSize:13,fontWeight:'700',color:'#475569'},
  financeMoney:{fontSize:32,fontWeight:'900',color:'#0F172A',letterSpacing:-0.5},
  financeRule:{height:1,backgroundColor:'rgba(100,116,139,0.18)'},
  financeDescription:{fontSize:12,lineHeight:19,color:'#475569'},
  refundUnavailable:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:'#F8FAFC',padding:14,borderRadius:12},
  refundUnavailableText:{color:'#64748B',fontSize:14,fontWeight:'700'},
  refundValue:{fontSize:30,fontWeight:'900',color:'#0F172A'},
  refundMiniGrid:{flexDirection:'row',gap:10},
  refundMini:{flex:1,backgroundColor:'#F8FAFC',padding:14,borderRadius:14,gap:6},
  refundMiniCount:{fontSize:23,fontWeight:'800',color:'#C65000'},
  refundMiniLabel:{fontSize:11,fontWeight:'600',lineHeight:16,color:'#64748B'},
});
