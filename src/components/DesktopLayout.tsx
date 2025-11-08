import { useState } from 'react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { useMessaging } from '../hooks/useMessaging';

export function DesktopLayout() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const { channels, isReady } = useMessaging();

  const selectedChat = channels.find(chat => chat.id.id === selectedChatId);

  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    setShowMobileChat(true);
  };

  const handleBackToChatList = () => {
    setShowMobileChat(false);
  };

  return (
    <div className="w-full h-full bg-gray-900 titillium-web-regular">
      {/* Desktop Layout */}{/* Desktop Layout */}
      <div className="hidden md:flex w-full h-full">
        {/* Left Panel - Chat List */}
        <div className="w-1/3 min-w-80 max-w-md">
          <ChatList 
            onSelect={handleChatSelect}
            selectedChatId={selectedChatId || undefined}
          />
        </div>
        <div className="flex-1 border-l border-gray-700/30">
          {selectedChat ? (
            <ChatWindow
              channelId={selectedChat.id.id}
              isMobile={false}
              handleBackToChatList={handleBackToChatList}
            />
          ) : (
            <div className="w-full h-full bg-white flex items-center justify-center px-6">
              <div className="max-w-md w-full text-center px-10 py-12 bg-white rounded-[2rem] border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,0.15)]">
                <div className="w-20 h-20 bg-vibrant-purple rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-black">
                  <ChatBubbleIcon className="w-10 h-10 text-black" />
                </div>
                <h2 className="text-2xl font-black text-black mb-3 titillium-web-bold">
                  {isReady ? 'Pick a conversation' : 'Warming up the igloo'}
                </h2>
                <p className="text-black/70 font-bold">
                  {!isReady
                    ? 'Initializing secure messaging. Hang tight while we gather your channels.'
                    : 'Select a chat from the list or start a new one to begin messaging.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden w-full h-full">
        {!showMobileChat ? (
          <ChatList 
            onSelect={handleChatSelect}
            selectedChatId={selectedChatId || undefined}
          />
        ) : (
          <div className="w-full h-full relative">
            <ChatWindow
              channelId={selectedChat?.id.id || ''}
              isMobile={true}
              handleBackToChatList={handleBackToChatList}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default DesktopLayout;