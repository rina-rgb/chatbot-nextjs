'use client';

import { useCallback, useState } from 'react';
import { PipecatClient, RTVIEvent } from "@pipecat-ai/client-js";
import {
  PipecatClientProvider,
  PipecatClientAudio,
  PipecatClientMicToggle,
  usePipecatClient,
  usePipecatClientTransportState,
  useRTVIClientEvent,
  usePipecatClientMicControl,
} from "@pipecat-ai/client-react";
import { GeminiLiveWebsocketTransport } from "@pipecat-ai/gemini-live-websocket-transport";
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

// Create Pipecat client with Gemini Live transport
const createPipecatClient = (apiKey: string) => {
  return new PipecatClient({
    transport: new GeminiLiveWebsocketTransport({
      api_key: apiKey,
      generation_config: {
        temperature: 0.7,
        maxOutput_tokens: 1000,
        response_modalities: "AUDIO",
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: "Aoede"
            }
          }
        }
      }
    }),
    enableMic: true,
    enableCam: false, // Voice-only for now
  });
};

// Voice chat component using official Pipecat hooks
function VoiceChatPipecatInner({ apiKey, className }: { apiKey: string; className?: string }) {
  const pcClient = usePipecatClient();
  const transportState = usePipecatClientTransportState();
  const { enableMic, isMicEnabled } = usePipecatClientMicControl();
  const [isConnecting, setIsConnecting] = useState(false);

  // Listen to transport state changes
  useRTVIClientEvent(
    RTVIEvent.TransportStateChanged,
    useCallback((state: string) => {
      console.log("🔄 Transport state changed:", state);
      setIsConnecting(state === 'connecting');
    }, [])
  );

  // Listen to bot ready event
  useRTVIClientEvent(
    RTVIEvent.BotReady,
    useCallback(() => {
      console.log("🤖 Bot is ready for conversation");
      toast.success('Voice bot is ready!');
    }, [])
  );

  // Listen to user audio events
  useRTVIClientEvent(
    RTVIEvent.UserStartedSpeaking,
    useCallback(() => {
      console.log("🎤 User started speaking");
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.UserStoppedSpeaking,
    useCallback(() => {
      console.log("🎤 User stopped speaking");
    }, [])
  );

  // Listen to bot audio events
  useRTVIClientEvent(
    RTVIEvent.BotStartedSpeaking,
    useCallback(() => {
      console.log("🔊 Bot started speaking");
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotStoppedSpeaking,
    useCallback(() => {
      console.log("🔊 Bot stopped speaking");
    }, [])
  );

  // Handle connection
  const handleConnect = useCallback(async () => {
    if (transportState === 'connected' || transportState === 'ready') {
      // Disconnect
      try {
        await pcClient?.disconnect();
        toast.info('Disconnected from voice chat');
      } catch (error) {
        console.error('❌ Disconnect error:', error);
        toast.error('Failed to disconnect');
      }
    } else {
      // Connect
      try {
        console.log('🚀 Connecting to Pipecat voice service...');
        
        // Connect directly to Gemini Live via the transport
        await pcClient?.connect({});
        console.log('✅ Connected to Gemini Live!');
        
      } catch (error) {
        console.error('❌ Connection error:', error);
        toast.error('Connection failed');
      }
    }
  }, [pcClient, transportState]);

  const isConnected = transportState === 'connected' || transportState === 'ready';
  const isConnectingState = transportState === 'connecting' || transportState === 'initializing';

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h3 className="font-medium text-lg">🎤 Pipecat Voice Chat</h3>
            <p className="text-sm text-muted-foreground">Official Pipecat React integration</p>
          </div>

          {/* Status */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className={`size-2 rounded-full ${
                isConnected ? 'bg-green-500' : 
                isConnectingState ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-sm font-medium">
                Transport: {transportState || 'disconnected'}
              </span>
            </div>
            
            {isMicEnabled && (
              <div className="flex items-center justify-center space-x-1 text-sm text-blue-600">
                <Mic className="size-4" />
                <span>Microphone active</span>
              </div>
            )}
          </div>

          {/* Controls using official Pipecat components */}
          <div className="flex justify-center space-x-3">
            {/* Connection Button */}
            <Button
              onClick={handleConnect}
              variant={isConnected ? "destructive" : "default"}
              size="lg"
              disabled={isConnectingState}
            >
              {isConnected ? <PhoneOff className="size-5 mr-2" /> : <Phone className="size-5 mr-2" />}
              {isConnected ? 'End Call' : isConnectingState ? 'Connecting...' : 'Start Call'}
            </Button>

            {/* Microphone Toggle using Pipecat component */}
            <PipecatClientMicToggle
              onMicEnabledChanged={(enabled) => {
                console.log("Microphone", enabled ? "enabled" : "disabled");
                toast.info(`Microphone ${enabled ? "enabled" : "disabled"}`);
              }}
              disabled={!isConnected}
            >
              {({ disabled, isMicEnabled, onClick }) => (
                <Button
                  onClick={onClick}
                  disabled={disabled}
                  variant={isMicEnabled ? "default" : "secondary"}
                  size="lg"
                >
                  {isMicEnabled ? <Mic className="size-5 mr-2" /> : <MicOff className="size-5 mr-2" />}
                  {isMicEnabled ? 'Mute' : 'Unmute'}
                </Button>
              )}
            </PipecatClientMicToggle>
          </div>
        </div>
      </CardContent>

      {/* Official Pipecat Audio Component */}
      <PipecatClientAudio />
    </Card>
  );
}

// Main component with provider
export function VoiceChatPipecat({ apiKey, className }: { apiKey: string; className?: string }) {
  // Create client with API key
  const pipecatClient = createPipecatClient(apiKey);
  
  return (
    <PipecatClientProvider client={pipecatClient}>
      <VoiceChatPipecatInner apiKey={apiKey} className={className} />
    </PipecatClientProvider>
  );
}