import pathlib,json,re,hashlib,subprocess,shutil,datetime
# Snapshot value was pathlib.Path('/workspace/blocks-sound-library'). Sample archives under assets/inspected are not in this repo.
B=pathlib.Path(__file__).resolve().parents[1]; I=B/'assets/inspected'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return str(p.relative_to(B))
sets=[('piano-kw-small-flac','UprightPianoKW-small-SFZ+FLAC-20190703','cc0.txt'),('synth-drums','SynthesizerPercussion-SFZ-20220718','LICENSE')];inventories={}
for id,folder,lic in sets:
 root=I/folder/folder;sfz=next(root.glob('*.sfz'));globalops={};group={};regions=[]
 text=re.sub(r'//[^\n]*','',sfz.read_text())
 for kind,body in re.findall(r'<(\w+)>([^<]*)',text):
  ops=dict(re.findall(r'(\w+)\s*=\s*([^\s]+)',body))
  if kind=='global':globalops=ops
  elif kind=='group':group=ops
  elif kind=='region':regions.append({**globalops,**group,**ops})
 samples=[]
 for p in sorted((root/'samples').iterdir()):
  if p.suffix.lower() not in ['.wav','.flac']:continue
  probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=sample_rate,channels,bits_per_raw_sample,bits_per_sample,duration_ts,time_base','-of','json',str(p)]))['streams'][0]
  rate=int(probe['sample_rate']);channels=probe['channels'];frames=probe['duration_ts'];bits=int(probe.get('bits_per_raw_sample') or probe.get('bits_per_sample'))
  samples.append(dict(path=rel(p),name=p.name,sha256=sha(p),file_bytes=p.stat().st_size,sample_rate_hz=rate,channels=channels,source_bits=bits,frames=frames,duration_seconds=frames/rate,decoded_source_pcm_bytes=frames*channels*bits//8,decoded_float32_bytes=frames*channels*4))
 out=dict(id=id,source_sfz=rel(sfz),sfz_sha256=sha(sfz),sample_count=len(samples),source_region_count=len(regions),source_regions=regions,samples=samples,source_audio_file_bytes=sum(s['file_bytes'] for s in samples),decoded_source_pcm_bytes=sum(s['decoded_source_pcm_bytes'] for s in samples),decoded_float32_bytes=sum(s['decoded_float32_bytes'] for s in samples),sample_rates_hz=sorted(set(s['sample_rate_hz'] for s in samples)),channels=sorted(set(s['channels'] for s in samples)),source_bits=sorted(set(s['source_bits'] for s in samples)))
 inventories[id]=out
 shutil.copyfile(root/lic,B/'licences'/f'{id}-CC0-1.0.txt');shutil.copyfile(root/'readme.txt',B/'licences'/f'{id}-readme.txt')
(B/'research/inspected-audio.json').write_text(json.dumps(inventories,indent=2))
# These are proposed mappings, not a converted or approved asset pack.
gm=[(35,'Kick06.wav','Bass drum 2'),(36,'Kick04.wav','Bass drum 1'),(38,'Snare09.wav','Snare 1'),(40,'Snare14.wav','Snare 2'),(42,'ClosedHiHat01-01.wav','Closed hi-hat'),(44,'ClosedHiHat02-01.wav','Pedal hi-hat surrogate, not a recorded pedal'),(46,'OpenHiHat02-01.wav','Open hi-hat'),(49,'Cymbal01-01.wav','Crash slot; source says Cymbal 1'),(51,'Cymbal02.wav','Ride slot surrogate; source says Cymbal 2'),(41,'LowTom02-01.wav','Low floor tom'),(43,'LowTom02-02.wav','High floor tom'),(45,'MidTom02-01.wav','Low tom'),(47,'MidTom02-02.wav','Low-mid tom'),(48,'HighTom02-01.wav','Hi-mid tom'),(50,'HighTom02-02.wav','High tom'),(39,'Clap01.wav','Hand clap'),(70,'Shaker04.wav','Maracas surrogate'),(82,'ShakerLong01.wav','Shaker'),(75,'Claves01.wav','Claves')]
maprows=[dict(midi_note=n,sample=f,label=l,velocity_range_proposed=[1,127],choke_group_proposed='hihat' if n in [42,44,46] else None) for n,f,l in gm]
defaultnotes=[36,38,40,42,44,46,41,45,48,49,51,39]
subset=[r for r in maprows if r['midi_note'] in defaultnotes];selected=set(r['sample'] for r in subset);ss=[s for s in inventories['synth-drums']['samples'] if s['name'] in selected]
drum_proposal=dict(status='proposal_pending_audio_approval_not_converted',source_not_gm=True,all_mapping=maprows,gate1_mapping=subset,gate1_region_count=len(subset),gate1_unique_sample_count=len(ss),gate1_original_wav_file_bytes=sum(s['file_bytes'] for s in ss),gate1_decoded_source_pcm_bytes=sum(s['decoded_source_pcm_bytes'] for s in ss),gate1_decoded_float32_bytes=sum(s['decoded_float32_bytes'] for s in ss),transport_compressed_subset_bytes=None,note='Retain single fixed Cymbal01-01; omit source random variants. Do not transpose at GM remap: new root equals new key to play original rate. Hats need explicit choke design. No real ride/pedal/brush articulation verified.')
(B/'research/drum-map-proposal.json').write_text(json.dumps(drum_proposal,indent=2))
print(json.dumps({k:{x:v[x] for x in ['sample_count','source_region_count','source_audio_file_bytes','decoded_source_pcm_bytes','decoded_float32_bytes','sample_rates_hz','channels','source_bits']} for k,v in inventories.items()},indent=2));print(json.dumps({k:v for k,v in drum_proposal.items() if not isinstance(v,list)},indent=2))
