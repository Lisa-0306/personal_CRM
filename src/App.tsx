import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Calendar from './pages/Calendar';
import Contacts from './pages/Contacts';
import Meetings from './pages/Meetings';
import Settings from './pages/Settings';
import { Contact, ScheduleItem } from './types';
import { LocalStorage } from './utils/storage';
import { initializeSampleData } from './utils/sampleData';

function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初始化示例数据（仅在首次使用时）
    initializeSampleData();
    
    // 加载初始数据
    const loadData = () => {
      const savedContacts = LocalStorage.getContacts();
      const savedSchedules = LocalStorage.getSchedules();
      
      setContacts(savedContacts);
      setSchedules(savedSchedules);
      setIsLoading(false);
    };

    loadData();
  }, []);

  const addContact = (contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newContact: Contact = {
      ...contact,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);
    LocalStorage.saveContacts(updatedContacts);
  };

  const updateContact = (id: string, updates: Partial<Contact>) => {
    const updatedContacts = contacts.map(contact =>
      contact.id === id
        ? { ...contact, ...updates, updatedAt: new Date() }
        : contact
    );
    setContacts(updatedContacts);
    LocalStorage.saveContacts(updatedContacts);
  };

  const deleteContact = (id: string) => {
    const updatedContacts = contacts.filter(contact => contact.id !== id);
    setContacts(updatedContacts);
    LocalStorage.saveContacts(updatedContacts);
  };

  const addSchedule = (schedule: Omit<ScheduleItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newSchedule: ScheduleItem = {
      ...schedule,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const updatedSchedules = [...schedules, newSchedule];
    setSchedules(updatedSchedules);
    LocalStorage.saveSchedules(updatedSchedules);
  };

  const updateSchedule = (id: string, updates: Partial<ScheduleItem>) => {
    const updatedSchedules = schedules.map(schedule =>
      schedule.id === id
        ? { ...schedule, ...updates, updatedAt: new Date() }
        : schedule
    );
    setSchedules(updatedSchedules);
    LocalStorage.saveSchedules(updatedSchedules);
  };

  const deleteSchedule = (id: string) => {
    const updatedSchedules = schedules.filter(schedule => schedule.id !== id);
    setSchedules(updatedSchedules);
    LocalStorage.saveSchedules(updatedSchedules);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route 
              path="/" 
              element={
                <Dashboard 
                  contacts={contacts}
                  schedules={schedules}
                  onAddSchedule={addSchedule}
                  onUpdateSchedule={updateSchedule}
                  onDeleteSchedule={deleteSchedule}
                />
              } 
            />
            <Route 
              path="/calendar" 
              element={
                <Calendar 
                  schedules={schedules}
                  contacts={contacts}
                  onAddSchedule={addSchedule}
                  onUpdateSchedule={updateSchedule}
                  onDeleteSchedule={deleteSchedule}
                />
              } 
            />
            <Route 
              path="/contacts" 
              element={
                <Contacts 
                  contacts={contacts}
                  onAddContact={addContact}
                  onUpdateContact={updateContact}
                  onDeleteContact={deleteContact}
                />
              } 
            />
            <Route 
              path="/meetings" 
              element={
                <Meetings 
                  schedules={schedules.filter(s => s.type === 'meeting')}
                  contacts={contacts}
                  onAddSchedule={addSchedule}
                  onUpdateSchedule={updateSchedule}
                  onDeleteSchedule={deleteSchedule}
                />
              } 
            />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 