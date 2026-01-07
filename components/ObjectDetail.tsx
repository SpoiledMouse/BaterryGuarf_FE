import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Plus, BookOpen, Edit, Shield, Calendar, ClipboardCheck, 
  Users, Battery as BatteryIcon, Phone, Mail, FileText, Bell, Trash2, X, Save, AlertCircle
} from 'lucide-react';
import { 
  BuildingObject, BatteryStatus, Contact, RegularEvent, ObjectGroup, 
  TechType, Technology, Battery, LogEntry, FormTemplate 
} from '../types';
import { getApiService } from '../services/apiService';
import { authService } from '../services/authService';

interface ObjectDetailProps {
  objects: BuildingObject[];
  setObjects: (objects: BuildingObject[]) => void;
  groups: ObjectGroup[];
}

const ObjectDetail: React.FC<ObjectDetailProps> = ({ objects, setObjects, groups }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const api = getApiService();
  const currentUser = authService.getCurrentUser();

  const [activeTab, setActiveTab] = useState<'tech' | 'log' | 'events' | 'info'>('tech');
  
  // Modals state
  const [isTechModalOpen, setTechModalOpen] = useState(false);
  const [isBatteryModalOpen, setBatteryModalOpen] = useState<{ techId: string } | null>(null);
  const [isLogModalOpen, setLogModalOpen] = useState(false);
  const [isEditObjectModalOpen, setEditObjectModalOpen] = useState(false);
  const [isEventModalOpen, setEventModalOpen] = useState(false);
  const [isContactModalOpen, setContactModalOpen] = useState(false);
  
  // Data pro formuláře
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [logFormData, setLogFormData] = useState<Record<string, string>>({});
  const [editingEvent, setEditingEvent] = useState<RegularEvent | null>(null);

  // Nalezení objektu
  const object = objects.find(o => o.id === id);

  // Načtení šablon pro Deník při otevření komponenty
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const tpls = await api.getTemplates();
        setTemplates(tpls);
        if (tpls.length > 0) setSelectedTemplateId(tpls[0].id);
      } catch (e) {
        console.error("Failed to load templates", e);
      }
    };
    fetchTemplates();
  }, []);

  if (!object) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <AlertCircle className="w-12 h-12 text-gray-400" />
        <div className="text-xl text-gray-600 font-bold">Objekt nebyl nalezen</div>
        <button onClick={() => navigate('/objects')} className="text-blue-600 hover:underline">Zpět na seznam</button>
      </div>
    );
  }

  // --- HANDLERS PRO AKTUALIZACI DAT ---

  const updateCurrentObject = (updatedObject: BuildingObject) => {
    const newObjects = objects.map(o => o.id === updatedObject.id ? updatedObject : o);
    setObjects(newObjects);
  };

  // 1. Technologie
  const handleAddTechnology = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const newTech: Technology = {
      id: Math.random().toString(36).substr(2, 9),
      name: fd.get('name') as string,
      type: fd.get('type') as TechType,
      location: fd.get('location') as string,
      batteries: []
    };

    const updatedObject = {
      ...object,
      technologies: [...object.technologies, newTech]
    };
    
    updateCurrentObject(updatedObject);
    setTechModalOpen(false);
  };

  const removeTechnology = (techId: string) => {
    if(!confirm("Opravdu smazat tento systém a všechny jeho baterie?")) return;
    const updatedObject = {
      ...object,
      technologies: object.technologies.filter(t => t.id !== techId)
    };
    updateCurrentObject(updatedObject);
  };

  // 2. Baterie
  const handleAddBattery = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isBatteryModalOpen) return;
    const fd = new FormData(e.currentTarget);

    const newBattery: Battery = {
      id: Math.random().toString(36).substr(2, 9),
      capacityAh: parseFloat(fd.get('capacityAh') as string),
      voltageV: parseFloat(fd.get('voltageV') as string),
      installDate: fd.get('installDate') as string,
      lastCheckDate: new Date().toISOString().split('T')[0], // Dnes
      nextReplacementDate: fd.get('nextReplacementDate') as string,
      status: fd.get('status') as BatteryStatus,
      manufactureDate: fd.get('manufactureDate') as string,
      notes: fd.get('notes') as string,
      serialNumber: fd.get('serialNumber') as string
    };

    const updatedObject = {
      ...object,
      technologies: object.technologies.map(t => {
        if (t.id === isBatteryModalOpen.techId) {
          return { ...t, batteries: [...t.batteries, newBattery] };
        }
        return t;
      })
    };

    updateCurrentObject(updatedObject);
    setBatteryModalOpen(null);
  };

  const removeBattery = (techId: string, batteryId: string) => {
    if(!confirm("Opravdu smazat tuto baterii?")) return;
    const updatedObject = {
      ...object,
      technologies: object.technologies.map(t => {
        if (t.id === techId) {
          return { ...t, batteries: t.batteries.filter(b => b.id !== batteryId) };
        }
        return t;
      })
    };
    updateCurrentObject(updatedObject);
  };

  // 3. Kontakty
  const handleUpdateContacts = (newContacts: Contact[]) => {
    updateCurrentObject({ ...object, contacts: newContacts });
  };

  const handleRemoveContact = (contactId: string) => {
    if (!confirm('Opravdu smazat kontakt?')) return;
    handleUpdateContacts((object.contacts || []).filter(c => c.id !== contactId));
  };

  const addContact = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newContact: Contact = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      role: formData.get('role') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string
    };
    handleUpdateContacts([...(object.contacts || []), newContact]);
    setContactModalOpen(false);
  };

  // 4. Deník / Logy
  const handleAddLogEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    const newEntry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      templateId: template.id,
      templateName: template.name,
      date: new Date().toISOString(),
      author: currentUser?.name || 'Neznámý',
      data: logFormData
    };

    // Speciální logika: Pokud je to "Revize" (t-revision) a má pole "Příští termín" (f7), 
    // můžeme automaticky vytvořit/aktualizovat plánovanou událost.
    // Pro jednoduchost zde jen uložíme log.

    updateCurrentObject({
      ...object,
      logEntries: [newEntry, ...(object.logEntries || [])]
    });

    setLogModalOpen(false);
    setLogFormData({});
  };

  // 5. Plánované události
  const handleSaveEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const eventData: RegularEvent = {
      id: editingEvent ? editingEvent.id : Math.random().toString(36).substr(2, 9),
      title: fd.get('title') as string,
      startDate: fd.get('startDate') as string,
      nextDate: fd.get('nextDate') as string,
      interval: fd.get('interval') as any,
      description: fd.get('description') as string,
      isActive: true,
      precisionOnDay: true // Default
    };

    let newEvents = object.scheduledEvents || [];
    if (editingEvent) {
      newEvents = newEvents.map(ev => ev.id === editingEvent.id ? eventData : ev);
    } else {
      newEvents = [...newEvents, eventData];
    }

    updateCurrentObject({ ...object, scheduledEvents: newEvents });
    setEventModalOpen(false);
    setEditingEvent(null);
  };

  const removeEvent = (eventId: string) => {
    if(!confirm("Smazat tuto připomínku?")) return;
    updateCurrentObject({
      ...object,
      scheduledEvents: (object.scheduledEvents || []).filter(e => e.id !== eventId)
    });
  };

  // Pomocné funkce
  const getGroupInfo = (groupId?: string) => {
    const g = groups.find(g => g.id === groupId);
    return g || { name: 'Bez skupiny', color: '#94a3b8' };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex gap-5">
            <button 
              onClick={() => navigate('/objects')} 
              className="p-3 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-2xl transition-all h-fit active:scale-90"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">{object.name}</h1>
                <span className="px-3 py-1 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg" style={{ backgroundColor: getGroupInfo(object.groupId).color }}>
                  {getGroupInfo(object.groupId).name}
                </span>
              </div>
              <div className="flex items-center text-gray-500 dark:text-slate-400 mt-2 font-medium">
                <MapPin className="w-4 h-4 mr-1.5 text-blue-500" />
                <span className="text-sm">{object.address}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
             <button onClick={() => setLogModalOpen(true)} className="flex-1 md:flex-none px-5 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-white rounded-2xl font-bold text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-slate-750 transition-all flex items-center justify-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> Nový zápis
            </button>
            <button onClick={() => setEditObjectModalOpen(true)} className="px-5 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              <Edit className="w-4 h-4" /> Upravit objekt
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-gray-100 dark:bg-slate-900 rounded-[1.5rem] border border-gray-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
        <TabButton active={activeTab === 'tech'} onClick={() => setActiveTab('tech')} icon={<Shield />} label="Technologie" />
        <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')} icon={<Users />} label="Kontakty & Info" />
        <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={<Calendar />} label="Plánované" />
        <TabButton active={activeTab === 'log'} onClick={() => setActiveTab('log')} icon={<ClipboardCheck />} label="Deník" />
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
        
        {/* --- 1. TECHNOLOGIE TAB --- */}
        {activeTab === 'tech' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Seznam systémů</h3>
               <button onClick={() => setTechModalOpen(true)} className="text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1 hover:underline">
                 <Plus className="w-4 h-4" /> Přidat systém
               </button>
            </div>
            
            {object.technologies.length === 0 && (
                <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-800">
                    <Shield className="w-12 h-12 mx-auto text-gray-200 mb-2" />
                    <p className="text-gray-400 font-bold">Zatím žádné technologie</p>
                </div>
            )}

            {object.technologies.map(tech => (
              <div key={tech.id} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/20 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl"><Shield className="w-6 h-6" /></div>
                    <div>
                      <h3 className="text-xl font-black text-gray-800 dark:text-white leading-tight">{tech.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{tech.type}</span>
                          <span className="text-sm text-gray-500 dark:text-slate-400 font-medium">{tech.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeTechnology(tech.id)} className="p-2 text-gray-400 hover:text-red-500 transition">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setBatteryModalOpen({ techId: tech.id })} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 rounded-xl font-bold text-xs shadow-sm hover:ring-2 hover:ring-blue-500/20 transition-all flex items-center gap-2">
                        <Plus className="w-4 h-4 text-blue-500" /> Baterie
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {tech.batteries.length === 0 ? (
                    <p className="text-center py-4 text-gray-400 dark:text-slate-600 italic font-medium text-xs">Žádné evidované akumulátory.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tech.batteries.map(battery => (
                        <div key={battery.id} className="relative p-5 rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-blue-200 dark:hover:border-blue-900 transition-all group">
                          <button 
                            onClick={() => removeBattery(tech.id, battery.id)}
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-2">
                              <BatteryIcon className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                              <span className="font-black text-gray-800 dark:text-slate-200">{battery.capacityAh}Ah / {battery.voltageV}V</span>
                            </div>
                            <StatusBadge status={battery.status} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-600">Instalace: {new Date(battery.installDate).toLocaleDateString()}</p>
                            <p className="text-[10px] font-black uppercase text-amber-500">Výměna: {new Date(battery.nextReplacementDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- 2. INFO TAB --- */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            {/* Contacts */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-500" /> Kontakty
                </h3>
                <button 
                  onClick={() => setContactModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" /> Přidat kontakt
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(!object.contacts || object.contacts.length === 0) ? (
                  <p className="col-span-full text-center py-6 text-slate-400 dark:text-slate-600 font-medium italic">Žádné uložené kontakty.</p>
                ) : (
                  object.contacts.map(contact => (
                    <div key={contact.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 border border-transparent dark:border-slate-800 rounded-3xl flex justify-between items-start group">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-black text-gray-800 dark:text-white">{contact.name}</h4>
                          <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{contact.role}</p>
                        </div>
                        <div className="space-y-1.5">
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors font-medium">
                            <Phone className="w-4 h-4" /> {contact.phone}
                          </a>
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors font-medium">
                            <Mail className="w-4 h-4" /> {contact.email}
                          </a>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveContact(contact.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-gray-100 dark:border-slate-800 shadow-sm">
               <h3 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2 mb-4">
                  <FileText className="w-6 h-6 text-amber-500" /> Interní poznámky a kódy
               </h3>
               <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-transparent dark:border-slate-800">
                 {object.internalNotes ? (
                   <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed">
                     {object.internalNotes}
                   </p>
                 ) : (
                   <p className="text-slate-400 dark:text-slate-600 italic font-medium">Žádné interní poznámky k tomuto objektu.</p>
                 )}
               </div>
            </div>
          </div>
        )}

        {/* --- 3. EVENTS TAB --- */}
        {activeTab === 'events' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
               <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Časová osa revizí</h3>
               <button onClick={() => { setEditingEvent(null); setEventModalOpen(true); }} className="text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1 hover:underline">
                 <Plus className="w-4 h-4" /> Nová událost
               </button>
            </div>
            {(!object.scheduledEvents || object.scheduledEvents.length === 0) ? (
              <div className="bg-white dark:bg-slate-900 p-16 text-center rounded-[2.5rem] border-2 border-dashed border-gray-100 dark:border-slate-800">
                <Bell className="w-12 h-12 text-gray-200 dark:text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-500 dark:text-slate-400">Žádné plánované akce</h3>
              </div>
            ) : (
              object.scheduledEvents.map(event => (
                <div key={event.id} className="relative bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col md:flex-row gap-6 group">
                   <button 
                      onClick={() => removeEvent(event.id)}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-colors"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                  <div className="bg-indigo-50 dark:bg-indigo-500/10 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[100px] h-fit">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{new Date(event.nextDate).toLocaleString('cs-CZ', { month: 'short' })}</span>
                    <span className="text-3xl font-black text-indigo-700 dark:text-indigo-400">{new Date(event.nextDate).getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-black text-gray-900 dark:text-white">{event.title}</h4>
                      <span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest">{event.interval}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 font-medium mb-4">{event.description}</p>
                    <div className="flex gap-2">
                       <button onClick={() => { setEditingEvent(event); setEventModalOpen(true); }} className="px-4 py-2 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-indigo-500 hover:text-white transition-all">Upravit</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- 4. LOG/DENÍK TAB --- */}
        {activeTab === 'log' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-4">Historie záznamů</h3>
            {(!object.logEntries || object.logEntries.length === 0) ? (
              <p className="text-center py-10 text-slate-400 dark:text-slate-600 font-medium">Deník je zatím prázdný.</p>
            ) : (
              object.logEntries.map(entry => (
                <div key={entry.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col gap-4">
                  <div className="flex gap-5 items-start">
                    <div className="p-4 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl h-fit"><BookOpen className="w-6 h-6" /></div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <h4 className="font-black text-gray-900 dark:text-white text-lg">{entry.templateName}</h4>
                            <span className="text-xs font-bold text-slate-400">{new Date(entry.date).toLocaleString()}</span>
                        </div>
                        <div className="text-xs font-bold text-blue-500 mt-0.5 uppercase tracking-widest">
                        Autor: {entry.author}
                        </div>
                    </div>
                  </div>
                  {/* Vykreslení dat záznamu */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-[5.5rem]">
                    {Object.entries(entry.data).map(([key, value]) => {
                         // Najdeme label pole ze šablony (pokud je dostupná), jinak použijeme key
                         const template = templates.find(t => t.id === entry.templateId);
                         const fieldLabel = template?.fields.find(f => f.id === key)?.label || "Pole";
                         return (
                            <div key={key} className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase">{fieldLabel}</span>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</span>
                            </div>
                         )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* 1. Modal: ADD TECHNOLOGY */}
      {isTechModalOpen && (
        <Modal title="Přidat systém" onClose={() => setTechModalOpen(false)}>
          <form onSubmit={handleAddTechnology} className="space-y-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Název systému</label>
              <input name="name" required placeholder="Např. Hlavní ústředna EPS" className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Typ technologie</label>
              <select name="type" className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold">
                {Object.values(TechType).map(type => (
                    <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Umístění</label>
              <input name="location" required placeholder="Např. 1.NP, Místnost serverovny" className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" />
            </div>
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Uložit systém</button>
          </form>
        </Modal>
      )}

      {/* 2. Modal: ADD BATTERY */}
      {isBatteryModalOpen && (
        <Modal title="Nová baterie" onClose={() => setBatteryModalOpen(null)}>
          <form onSubmit={handleAddBattery} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Kapacita (Ah)</label>
                    <input name="capacityAh" type="number" step="0.1" required className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Napětí (V)</label>
                    <input name="voltageV" type="number" step="0.1" required className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Datum instalace</label>
                    <input name="installDate" type="date" required className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Příští výměna</label>
                    <input name="nextReplacementDate" type="date" required className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>
            <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Sériové číslo</label>
                <input name="serialNumber" className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Stav</label>
              <select name="status" className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                <option value={BatteryStatus.HEALTHY}>V pořádku (Healthy)</option>
                <option value={BatteryStatus.WARNING}>Varování (Warning)</option>
                <option value={BatteryStatus.CRITICAL}>Kritický (Critical)</option>
                <option value={BatteryStatus.REPLACED}>Vyměněno (Replaced)</option>
              </select>
            </div>
            <button type="submit" className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-xl shadow-green-500/20 active:scale-95 transition-all">Uložit baterii</button>
          </form>
        </Modal>
      )}

      {/* 3. Modal: ADD LOG ENTRY (Dynamický) */}
      {isLogModalOpen && (
        <Modal title="Nový záznam" onClose={() => setLogModalOpen(false)}>
          <div className="space-y-6">
            <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Typ záznamu</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {templates.map(t => (
                        <button 
                            key={t.id}
                            onClick={() => setSelectedTemplateId(t.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border ${selectedTemplateId === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-700'}`}
                        >
                            {t.name}
                        </button>
                    ))}
                </div>
            </div>
            
            <form onSubmit={handleAddLogEntry} className="space-y-4">
                {templates.find(t => t.id === selectedTemplateId)?.fields.map(field => (
                    <div key={field.id}>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.type === 'textarea' ? (
                            <textarea 
                                required={field.required}
                                onChange={(e) => setLogFormData({...logFormData, [field.id]: e.target.value})}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                            />
                        ) : field.type === 'select' ? (
                            <select
                                required={field.required}
                                onChange={(e) => setLogFormData({...logFormData, [field.id]: e.target.value})}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Vyberte...</option>
                                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        ) : (
                            <input 
                                type={field.type}
                                required={field.required}
                                onChange={(e) => setLogFormData({...logFormData, [field.id]: e.target.value})}
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                    </div>
                ))}
                 <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-500/20 active:scale-95 transition-all mt-4">Uložit záznam</button>
            </form>
          </div>
        </Modal>
      )}

      {/* 4. Modal: CONTACT (Již byl ve snippetu, ponechávám) */}
      {isContactModalOpen && (
        <Modal title="Přidat kontakt" onClose={() => setContactModalOpen(false)}>
          <form onSubmit={addContact} className="space-y-6">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Jméno a příjmení</label>
              <input name="name" required className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Role / Pozice</label>
              <input name="role" required className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" placeholder="Např. Správce budovy" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Telefon</label>
                <input name="phone" className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" placeholder="+420..." />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">E-mail</label>
                <input name="email" className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" placeholder="email@domena.cz" />
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Uložit kontakt</button>
          </form>
        </Modal>
      )}

      {/* 5. Modal: EVENT (Planned Maintenance) */}
      {isEventModalOpen && (
        <Modal title={editingEvent ? "Upravit událost" : "Nová událost"} onClose={() => setEventModalOpen(false)}>
             <form onSubmit={handleSaveEvent} className="space-y-4">
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Název úkonu</label>
                    <input name="title" defaultValue={editingEvent?.title} required className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Např. Roční revize EPS" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Datum provedení</label>
                        <input name="startDate" type="date" defaultValue={editingEvent?.startDate} required className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                     </div>
                     <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Příští termín</label>
                        <input name="nextDate" type="date" defaultValue={editingEvent?.nextDate} required className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                     </div>
                </div>
                <div>
                     <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Interval opakování</label>
                     <select name="interval" defaultValue={editingEvent?.interval} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-bold dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                         <option value="Měsíčně">Měsíčně</option>
                         <option value="Čtvrtletně">Čtvrtletně</option>
                         <option value="Pololetně">Pololetně</option>
                         <option value="Ročně">Ročně</option>
                         <option value="Každé 2 roky">Každé 2 roky</option>
                     </select>
                </div>
                <div>
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Popis</label>
                    <textarea name="description" defaultValue={editingEvent?.description} className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 rounded-xl font-medium dark:text-white outline-none focus:ring-2 focus:ring-blue-500" rows={3} />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Uložit událost</button>
             </form>
        </Modal>
      )}

      {/* 6. Modal: EDIT OBJECT */}
      {isEditObjectModalOpen && (
        <Modal title="Upravit objekt" onClose={() => setEditObjectModalOpen(false)}>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const updated = {
              ...object,
              name: fd.get('name') as string,
              address: fd.get('address') as string,
              internalNotes: fd.get('internalNotes') as string,
              groupId: fd.get('groupId') as string || undefined
            };
            updateCurrentObject(updated);
            setEditObjectModalOpen(false);
          }} className="space-y-6">
             <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Název objektu</label>
              <input name="name" defaultValue={object.name} required className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Zákazník / Skupina</label>
              <select name="groupId" defaultValue={object.groupId} className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold">
                <option value="">Bez skupiny</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Adresa</label>
              <input name="address" defaultValue={object.address} required className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2">Interní poznámka</label>
              <textarea name="internalNotes" defaultValue={object.internalNotes} className="w-full px-5 py-4 bg-gray-50 dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 dark:text-white rounded-2xl outline-none font-bold" rows={5}></textarea>
            </div>
            <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Uložit změny</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

// --- POMOCNÉ KOMPONENTY ---

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick} 
    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm ring-1 ring-gray-200/50 dark:ring-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
  >
    {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const Modal: React.FC<{ title: string, children: React.ReactNode, onClose: () => void }> = ({ title, children, onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/10 max-h-[90vh] flex flex-col">
      <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
        <h2 className="text-xl font-black text-gray-800 dark:text-white tracking-tight uppercase">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="p-8 overflow-y-auto no-scrollbar">
          {children}
      </div>
    </div>
  </div>
);

const StatusBadge: React.FC<{ status: BatteryStatus }> = ({ status }) => {
  const styles = { 
    [BatteryStatus.HEALTHY]: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400', 
    [BatteryStatus.WARNING]: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', 
    [BatteryStatus.CRITICAL]: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400', 
    [BatteryStatus.REPLACED]: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' 
  };
  return <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${styles[status]}`}>{status}</span>;
};

export default ObjectDetail;