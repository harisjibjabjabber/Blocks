// Included inside bs_synth; requested configs stay immutable. Numeric clock
// choices are applied only to effective configurations, without phase reset.
 void numericVoicing(bs_osc_voicing_config&c,unsigned osc){c.count=uint32_t(std::llround(workspaceValue(c.count,4,26+osc,2)));}
 void numericDelay(bs_delay_config&c){if(!c.synced)return;const double offset=workspaceOffset(4,21,10);if(offset==0)return;const auto&list=blocks_detail::delayDivisions;const auto i=blocks_detail::steppedIndex(blocks_detail::divisionIndex(list,c.division,c.triplet),offset,unsigned(list.size()));c.division=list[i].division;c.triplet=list[i].triplet;}
 void numericBass(bs_osc_bass_entry_v2&c,unsigned osc){if(!c.synced)return;const double offset=workspaceOffset(4,24+osc,9);if(offset==0)return;const auto list=blocks_detail::bassDivisions(clockConfig.beats_per_bar);const auto i=blocks_detail::steppedIndex(blocks_detail::bassDivisionIndex(list,c.cycle_beats),offset,list.count);c.cycle_beats=float(list.beats[i]);}
 double numericTargetValue(unsigned kind,unsigned id,unsigned p)const{
  if(kind!=4)return std::numeric_limits<double>::quiet_NaN();
  if((id==26||id==27)&&p==2)return (id==26?unison:unison2).config().count;
  if(id==21&&p==10){const auto&c=delay.config();return blocks_detail::divisionIndex(blocks_detail::delayDivisions,c.division,c.triplet);}
  if((id==24||id==25)&&p==9){const auto list=blocks_detail::bassDivisions(clockConfig.beats_per_bar);return double(blocks_detail::bassDivisionIndex(list,oscBass.configV2().oscillators[id-24].cycle_beats))/(list.count-1);}
  return std::numeric_limits<double>::quiet_NaN();
 }
