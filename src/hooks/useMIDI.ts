'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface MIDIInput {
  id: string;
  name: string;
  manufacturer: string;
}

interface MIDIMessage {
  command: number;
  channel: number;
  note: number;
  velocity: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function midiNoteToNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function useMIDI(
  onNoteOn: (note: string, velocity: number) => void,
  onNoteOff: (note: string) => void
) {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState<MIDIInput[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<MIDIMessage | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());

  const parseMIDIMessage = useCallback((data: Uint8Array): MIDIMessage | null => {
    if (data.length < 3) return null;
    
    const status = data[0];
    const command = status >> 4;
    const channel = status & 0x0f;
    const note = data[1];
    const velocity = data[2];
    
    return { command, channel, note, velocity };
  }, []);

  const handleMIDIMessage = useCallback((event: MIDIMessageEvent) => {
    const data = event.data;
    if (!data) return;
    
    const message = parseMIDIMessage(data);
    if (!message) return;
    
    setLastMessage(message);
    
    const noteName = midiNoteToNoteName(message.note);
    
    // Note On (command 9) with velocity > 0
    if (message.command === 9 && message.velocity > 0) {
      activeNotesRef.current.add(message.note);
      onNoteOn(noteName, message.velocity / 127);
    }
    // Note Off (command 8) or Note On with velocity 0
    else if (message.command === 8 || (message.command === 9 && message.velocity === 0)) {
      activeNotesRef.current.delete(message.note);
      onNoteOff(noteName);
    }
  }, [parseMIDIMessage, onNoteOn, onNoteOff]);

  const connectToDevice = useCallback((deviceId: string) => {
    if (!midiAccessRef.current) return;
    
    // Disconnect from current device
    midiAccessRef.current.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    
    // Connect to new device
    const input = midiAccessRef.current.inputs.get(deviceId);
    if (input) {
      input.onmidimessage = handleMIDIMessage;
      setActiveDevice(deviceId);
      setIsConnected(true);
    }
  }, [handleMIDIMessage]);

  const disconnectDevice = useCallback(() => {
    if (!midiAccessRef.current) return;
    
    midiAccessRef.current.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    
    setActiveDevice(null);
    setIsConnected(false);
    activeNotesRef.current.clear();
  }, []);

  const updateDevices = useCallback(() => {
    if (!midiAccessRef.current) return;
    
    const deviceList: MIDIInput[] = [];
    midiAccessRef.current.inputs.forEach((input) => {
      deviceList.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
      });
    });
    setDevices(deviceList);
    
    // Auto-connect to first device if none connected
    if (deviceList.length > 0 && !activeDevice) {
      connectToDevice(deviceList[0].id);
    }
    
    // Disconnect if device was removed
    if (activeDevice && !deviceList.find(d => d.id === activeDevice)) {
      disconnectDevice();
    }
  }, [activeDevice, connectToDevice, disconnectDevice]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      setIsSupported(false);
      return;
    }
    
    setIsSupported(true);
    
    navigator.requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccessRef.current = access;
        updateDevices();
        
        access.onstatechange = () => {
          updateDevices();
        };
      })
      .catch((err) => {
        console.warn('MIDI access denied:', err);
        setIsSupported(false);
      });
    
    return () => {
      disconnectDevice();
    };
  }, [updateDevices, disconnectDevice]);

  return {
    isSupported,
    isConnected,
    devices,
    activeDevice,
    lastMessage,
    connectToDevice,
    disconnectDevice,
  };
}
