// Included inside extern "C" after the complete bs_synth definition.
void bs_default_envelopes(bs_envelopes_config*c){if(c)*c=blocks_detail::defaultEnvelopes();}
int bs_set_envelopes(bs_synth*s,const bs_envelopes_config*c){return s&&c?s->setEnvelopes(*c):0;}
int bs_get_envelopes(const bs_synth*s,bs_envelopes_config*c){if(!s||!c)return 0;*c=s->currentEnvelopes();return 1;}
double bs_get_envelope_value(const bs_synth*s,uint32_t id){return s&&id>=1&&id<=3?s->envelopeValues[id-1]:0;}
void bs_default_tuning(bs_tuning_config*c){if(c)*c=blocks_detail::defaultTuning();}
int bs_set_tuning(bs_synth*s,const bs_tuning_config*c){return s&&c?s->setTuning(*c):0;}
int bs_get_tuning(const bs_synth*s,bs_tuning_config*c){if(!s||!c)return 0;*c=s->tuningConfig;return 1;}
void bs_default_filter_bank(bs_filter_bank_config*c){if(c)*c=blocks_detail::defaultFilterBank();}
int bs_set_filter_bank(bs_synth*s,const bs_filter_bank_config*c){return s&&c?s->setFilterBank(*c):0;}
int bs_get_filter_bank(const bs_synth*s,bs_filter_bank_config*c){if(!s||!c)return 0;*c=s->currentFilterBank();return 1;}
const bs_modulation_target_descriptor*bs_modulation_target_info(uint32_t kind,uint32_t id,uint32_t p){return blocks_detail::workspaceTarget(kind,id,p);}
double bs_get_modulation_value(const bs_synth*s,uint32_t id){return s?s->modulation.value(id):0;}
double bs_get_modulated_target_value(const bs_synth*s,uint32_t kind,uint32_t id,uint32_t p){return s&&blocks_detail::workspaceTarget(kind,id,p)?s->modulatedValue(kind,id,p):std::numeric_limits<double>::quiet_NaN();}

int bs_sub_preview(uint32_t wave,float width,double frequency,double rate,float*out,uint32_t samples){
 if(wave>4||!std::isfinite(width)||width<.1f||width>.9f||!std::isfinite(frequency)||frequency<=0||!std::isfinite(rate)||rate<8000||rate>384000||frequency>=rate*.5||!out||samples<2||samples>2048)return 0;
 const double step=std::min(.45,frequency/rate);Weights weights{};weights[wave]=1;
 for(unsigned i=0;i<samples;++i){const double phase=double(i)/samples;out[i]=float(wave==0?blocks_detail::sine(phase):wave==1?blocks_detail::triangle(phase-.25,step):blocks_detail::StudioOscillator::mix(weights,phase,step,width));}return 1;
}
