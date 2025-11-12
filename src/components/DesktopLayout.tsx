import { useState } from 'react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { ChatBubbleIcon } from '@radix-ui/react-icons';
import { useMessaging } from '../hooks/useMessaging';
import convoImage from '../assets/convo.png';

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
      {/* Desktop Layout */}
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
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              {!isReady ? (
                // Initializing messaging screen - light purple version
                <div className="text-center">
                  <div className="w-16 h-16 bg-[#7A75E5] rounded-full flex items-center justify-center mx-auto mb-4">
                    <ChatBubbleIcon className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-[#7A75E5] mb-2">Welcome to Penguin</h2>
                  <p className="text-[#7A75E5]">
                    Initializing messaging...
                  </p>
                </div>
              ) : (
                // Ready state - background image
                <div 
                  className="w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${convoImage})` }}
                />
              )}
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