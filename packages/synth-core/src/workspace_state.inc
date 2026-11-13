// Included inside bs_synth. Requested configs stay separate from modulated
// processing configs: modulation never edits a saved patch or its dial values.
 bs_envelopes_config envelopeConfig=blocks_detail::defaultEnvelopes();
 bs_tuning_config tuningConfig=blocks_detail::defaultTuning();
 bs_filter_bank_config filterBank=blocks_detail::defaultFilterBank();
 bs_harmonics_suite_config baseSuite=blocks_detail::HarmonicsSuite::defaults();
 bs_delay_config baseDelay=blocks_detail::StereoDelay::defaults();
 bs_reverb_config baseReverb=blocks_detail::StereoReverb::defaults();
 bs_creative_fx_config baseCreative=blocks_detail::CreativeFXRack::defaults();
 bs_osc_bass_config_v2 baseBass=blocks_detail::defaultOscBassV2();
 bs_voicing_config_v2 baseVoicing{2,0,{{1,0,0},{1,0,0}}};
 bs_sub_config baseSub=blocks_detail::defaultSub();
 std::array<double,3> envelopeValues{},octaveSmooth{{0,0,-1}},fineSmooth{},filterBWeights{{1,0,0}};
 std::array<double,2> filterBRoutes{},filterBypassRoutes{};
 std::array<double,BS_PARAMETER_COUNT> visualTone{};
 std::array<std::array<double,4>,2> visualFilters{};
 std::array<std::array<double,7>,3> visualShapes{};
 std::array<double,3> visualFine{},visualOctave{};
 uint64_t workspaceCounter=0,visualVoiceOrder=0;
 double visualGain=.7,visualWidth=1,visualMotion=0;
 bool envelopeActive=false;
 bool workspaceRouted=false,workspaceBusWasActive=false;
 Weights subWaveWeights{{1,0,0,0,0}};

 bs_envelopes_config currentEnvelopes()const{auto c=envelopeConfig;for(unsigned e=0;e<2;++e){float v[7];for(unsigned i=0;i<7;++i)v[i]=parameters[(e?25:4)+i];std::memcpy(&c.sources[e].attack,v,sizeof v);}return c;}
 bs_filter_bank_config currentFilterBank()const{auto c=filterBank;auto&a=c.filters[0];a.cutoff=parameters[BS_CUTOFF];a.resonance=parameters[BS_FILTER_RESONANCE];a.mix=parameters[BS_FILTER_MIX];a.drive=soundConfig.filter_drive;a.model=soundConfig.filter_model?2:unsigned(parameters[BS_FILTER_MODE]);a.mask=filterRouting.mask;return c;}
 int setEnvelopes(const bs_envelopes_config&c){if(!blocks_detail::validEnvelopes(c))return 0;envelopeConfig=c;for(unsigned e=0;e<2;++e){float v[7];std::memcpy(v,&c.sources[e].attack,sizeof v);for(unsigned i=0;i<7;++i)parameters[(e?25:4)+i]=v[i];}refreshWorkspaceRoutes();return 1;}
 int setTuning(const bs_tuning_config&c){if(!blocks_detail::validTuning(c))return 0;tuningConfig=c;baseSub.octave=c.oscillators[2].octave;auto sub=subNotes.config;sub.octave=baseSub.octave;subNotes.configure(sub);return 1;}
 int setFilterBank(const bs_filter_bank_config&c){if(!blocks_detail::validFilterBank(c))return 0;filterBank=c;const auto&a=c.filters[0];parameters[BS_CUTOFF]=a.cutoff;parameters[BS_FILTER_RESONANCE]=a.resonance;parameters[BS_FILTER_MIX]=a.mix;parameters[BS_FILTER_MODE]=a.model==1?1:0;soundConfig.filter_model=a.model==2?1:0;soundConfig.filter_drive=a.drive;filterRouting.mask=a.mask;return 1;}
 void refreshWorkspaceRoutes(){workspaceRouted=false;for(const auto&s:envelopeConfig.sources)workspaceRouted|=s.route_count!=0;const auto&c=modulation.configV4();for(unsigned i=0;i<c.source_count;++i)if(c.sources[i].enabled)for(unsigned j=0;j<c.sources[i].route_count;++j)workspaceRouted|=c.sources[i].routes[j].target_kind>=4;}
 double envelopeOffset(unsigned kind,unsigned id,unsigned p,const Voice*v=nullptr)const{if(v?!v->active:!envelopeActive)return 0;double sum=0;for(unsigned e=0;e<3;++e){const auto&s=envelopeConfig.sources[e];const double value=v?v->envelopeValues[e]:envelopeValues[e];for(unsigned j=0;j<s.route_count;++j){const auto&r=s.routes[j];if(r.target_kind==kind&&r.target_id==id&&r.parameter_id==p)sum+=(r.polarity==BS_POLARITY_BIPOLAR?2*value-1:value)*r.depth;}}return sum;}
 double workspaceOffset(unsigned kind,unsigned id,unsigned p,const Voice*v=nullptr)const{return modulation.targetOffset(kind,id,p)+envelopeOffset(kind,id,p,v);}
 double workspaceValue(double base,unsigned kind,unsigned id,unsigned p,const Voice*v=nullptr)const{const auto*d=blocks_detail::workspaceTarget(kind,id,p);return d?blocks_detail::workspaceModulate(base,workspaceOffset(kind,id,p,v),*d):base;}
 template<class T>void modWords(T&c,unsigned id){for(unsigned word=0;word<sizeof(T)/4;++word)if(const auto*d=blocks_detail::workspaceTarget(4,id,word)){double offset=workspaceOffset(4,id,word);if(offset!=0)blocks_detail::wordFloat(c,word,float(blocks_detail::workspaceModulate(blocks_detail::wordFloat(c,word),offset,*d)));}}
 void restoreWorkspaceBus(){noteRack.restoreEffective();suite.configure(baseSuite);delay.configure(baseDelay);reverb.configure(baseReverb);if(creative)creative->configure(baseCreative);oscBass.configure(baseBass);unison.configure(baseVoicing.oscillators[0]);unison2.configure(baseVoicing.oscillators[1]);subNotes.configure(baseSub);workspaceBusWasActive=false;}
 void resetWorkspace(){restoreWorkspaceBus();workspaceCounter=0;envelopeValues={};envelopeActive=false;visualVoiceOrder=0;visualTone=smooth;for(unsigned i=0;i<3;++i){octaveSmooth[i]=tuningConfig.oscillators[i].octave;fineSmooth[i]=visualFine[i]=tuningConfig.oscillators[i].fine_cents;}filterBWeights={};filterBWeights[filterBank.filters[1].model]=1;subWaveWeights={};subWaveWeights[baseSub.waveform]=1;for(unsigned i=0;i<2;++i){double a=filterBank.filters[0].enabled&&bool(filterRouting.mask&(1u<<i))?1:0,b=filterBank.filters[1].enabled&&bool(filterBank.filters[1].mask&(1u<<i))?1:0,sum=a+b;filterRoutes[i]=sum?a/sum:0;filterBRoutes[i]=sum?b/sum:0;filterBypassRoutes[i]=sum?0:1;}refreshWorkspaceRoutes();}
 void workspaceControl(){
  if((workspaceCounter++&63)!=0)return;
  if(!workspaceRouted){if(workspaceBusWasActive)restoreWorkspaceBus();return;}workspaceBusWasActive=true;
  auto hs=baseSuite;modWords(hs,20);hs.ott_high_hz=std::max(hs.ott_high_hz,2*hs.ott_low_hz);suite.configure(hs);
  auto dc=baseDelay;modWords(dc,21);numericDelay(dc);delay.configure(dc);
  auto rc=baseReverb;modWords(rc,22);reverb.configure(rc);
  auto bc=baseBass;for(unsigned i=0;i<2;++i){modWords(bc.oscillators[i],24+i);numericBass(bc.oscillators[i],i);}oscBass.configure(bc);
  for(unsigned i=0;i<2;++i){auto vc=baseVoicing.oscillators[i];vc.detune_cents=float(workspaceValue(vc.detune_cents,4,26+i,0));vc.spread=float(workspaceValue(vc.spread,4,26+i,1));numericVoicing(vc,i);(i?unison2:unison).configure(vc);}
  auto sc=baseSub;sc.level=float(workspaceValue(sc.level,4,28,0));subNotes.configure(sc);
  auto cc=baseCreative;for(unsigned i=0;i<cc.count;++i){auto&b=cc.blocks[i];for(unsigned p=0;p<9;++p){const auto*d=blocks_detail::workspaceTarget(5,b.id,p);double offset=workspaceOffset(5,b.id,p);if(offset!=0)blocks_detail::wordFloat(b,3+p,float(blocks_detail::workspaceModulate(blocks_detail::wordFloat(b,3+p),offset,*d)));}}if(creative)creative->configure(cc);applyNoteModulation();
 }
 void workspaceSmoothing(){for(unsigned i=0;i<3;++i){octaveSmooth[i]+=smoothing*(tuningConfig.oscillators[i].octave-octaveSmooth[i]);fineSmooth[i]+=smoothing*(tuningConfig.oscillators[i].fine_cents-fineSmooth[i]);if(std::abs(octaveSmooth[i]-tuningConfig.oscillators[i].octave)<1e-12)octaveSmooth[i]=tuningConfig.oscillators[i].octave;if(std::abs(fineSmooth[i]-tuningConfig.oscillators[i].fine_cents)<1e-12)fineSmooth[i]=tuningConfig.oscillators[i].fine_cents;}
  for(unsigned i=0;i<3;++i){const double target=filterBank.filters[1].model==i?1:0;filterBWeights[i]+=std::min(1.,dt/.01)*(target-filterBWeights[i]);if(std::abs(filterBWeights[i]-target)<1e-12)filterBWeights[i]=target;}
 }
 void voiceWorkspace(Voice&v,std::array<double,BS_PARAMETER_COUNT>&values){
  if(workspaceRouted){for(unsigned p=0;p<BS_PARAMETER_COUNT;++p){const auto*d=blocks_detail::workspaceTarget(0,0,p);if(!d||p==BS_GAIN)continue;double offset=modulationSmooth[p]+envelopeOffset(0,0,p,&v);if(p==BS_CUTOFF)offset+=workspaceOffset(4,10,0,&v);if(p==BS_FILTER_RESONANCE)offset+=workspaceOffset(4,10,1,&v);if(p==BS_FILTER_MIX)offset+=workspaceOffset(4,10,2,&v);if(p>=4&&p<=10)offset+=workspaceOffset(4,40,p-4,&v);if(p>=25&&p<=31)offset+=workspaceOffset(4,41,p-25,&v);values[p]=blocks_detail::workspaceModulate(smooth[p],offset,*d);}}
  const double motionBase=blocks_detail::motionInverse(smooth[13]);
  if(workspaceOffset(4,50,0,&v)!=0){const double n=workspaceValue(motionBase,4,50,0,&v);values[13]=std::max(0.,std::min(120.,values[13]+blocks_detail::motionCurve(n,false)-blocks_detail::motionCurve(motionBase,false)));values[32]=std::max(0.,std::min(80.,values[32]+blocks_detail::motionCurve(n,true)-blocks_detail::motionCurve(motionBase,true)));}
  // Rescale elapsed stage time when a duration changes, preserving progress.
  const double times[]={values[BS_ATTACK],values[BS_DECAY],values[BS_RELEASE]};double*old[]={&v.attack,&v.decay,&v.release};for(unsigned i=0;i<3;++i){const auto stage=i==0?Stage::attack:i==1?Stage::decay:Stage::release;if(v.stage==stage&&*old[i]!=times[i])v.stageAge*=times[i]/(*old[i]);*old[i]=times[i];}v.sustain=values[BS_SUSTAIN_LEVEL];v.attackBend=values[BS_ATTACK_BEND];v.decayBend=values[BS_DECAY_BEND];v.releaseBend=values[BS_RELEASE_BEND];
  const auto update=[&](FilterEnvelope&f,const double*shape){double*oldTimes[]={&f.attack,&f.decay,&f.release};const unsigned at[]={0,1,3};for(unsigned i=0;i<3;++i){const auto stage=i==0?Stage::attack:i==1?Stage::decay:Stage::release;if(f.stage==stage&&*oldTimes[i]!=shape[at[i]])f.age*=shape[at[i]]/(*oldTimes[i]);*oldTimes[i]=shape[at[i]];}f.sustain=shape[2];f.attackBend=shape[4];f.decayBend=shape[5];f.releaseBend=shape[6];};
  double filterShape[7];for(unsigned i=0;i<7;++i)filterShape[i]=values[25+i];update(v.filterEnvelope,filterShape);
  float base[7];std::memcpy(base,&envelopeConfig.sources[2].attack,sizeof base);double shape[7];for(unsigned i=0;i<7;++i)shape[i]=workspaceRouted?workspaceValue(base[i],4,42,i,&v):base[i];update(v.auxEnvelope,shape);
 }
 double modulatedValue(unsigned kind,unsigned id,unsigned p)const{
  const auto*d=blocks_detail::workspaceTarget(kind,id,p);if(!d)return std::numeric_limits<double>::quiet_NaN();
  const double numeric=numericTargetValue(kind,id,p);if(std::isfinite(numeric))return numeric;
  if(kind==6)return noteTargetValue(id,p);
  if(kind==0)return p==0?visualGain:visualVoiceOrder?visualTone[p]:parameters[p];
  if(kind==2)return modulation.control(id,p);
  if(kind==3)return modulation.effectOffset(id)+envelopeOffset(kind,id,p);
  if(kind==1){for(unsigned i=0;i<sauceConfig.count;++i)if(sauceConfig.blocks[i].id==id)return blocks_detail::workspaceModulate(sauceConfig.blocks[i].amount,workspaceOffset(kind,id,p),*d);return std::numeric_limits<double>::quiet_NaN();}
  if(kind==5){const auto&c=creative->config();for(unsigned i=0;i<c.count;++i)if(c.blocks[i].id==id)return blocks_detail::wordFloat(c.blocks[i],3+p);return std::numeric_limits<double>::quiet_NaN();}
  if(id==10||id==11){if(visualVoiceOrder)return visualFilters[id-10][p];auto c=currentFilterBank();const auto&f=c.filters[id-10];const double v[]={f.cutoff,f.resonance,f.mix,f.drive};return v[p];}
  if(id==50)return visualVoiceOrder?visualMotion:blocks_detail::motionInverse(parameters[13]);
  if(id==20)return blocks_detail::wordFloat(suite.config(),p);
  if(id==21)return blocks_detail::wordFloat(delay.config(),p);
  if(id==22)return blocks_detail::wordFloat(reverb.config(),p);
  if(id==23)return visualWidth;
  if(id==24||id==25)return blocks_detail::wordFloat(oscBass.configV2().oscillators[id-24],p);
  if(id==26||id==27){const auto&c=(id==26?unison:unison2).config();return p?c.spread:c.detune_cents;}
  if(id==28)return p==0?subLevel:p==2?(subVoice.active?visualOctave[2]:tuningConfig.oscillators[2].octave):(subVoice.active?visualFine[2]:tuningConfig.oscillators[2].fine_cents);
  if(id==30||id==31)return p==1?(visualVoiceOrder?visualOctave[id-30]:tuningConfig.oscillators[id-30].octave):(visualVoiceOrder?visualFine[id-30]:tuningConfig.oscillators[id-30].fine_cents);
  if(id>=40&&id<=42){if(visualVoiceOrder)return visualShapes[id-40][p];auto c=currentEnvelopes();return blocks_detail::wordFloat(c.sources[id-40],1+p);}
  return std::numeric_limits<double>::quiet_NaN();
 }
