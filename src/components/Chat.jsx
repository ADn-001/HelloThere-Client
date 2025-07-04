import React from 'react';
import PropTypes from 'prop-types';

// Group chat UI component
const Chat = ({ messages, inputText, setInputText, handleSendMessage }) => {
  console.log('[Chat] Rendering with messages:', messages);

  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="mt-4">
      <h2 className="text-xl font-semibold mb-2">Group Chat</h2>
      <div className="h-96 border border-gray-300 p-2 mb-4 overflow-y-auto">
        {safeMessages.map((msg) => (
          <p
            key={msg.id}
            className={msg.sender === 'self' ? 'text-right text-blue-600' : 'text-left'}
          >
            <strong>{msg.sender}:</strong> {msg.text}
          </p>
        ))}
      </div>
      <div className="flex">
        <input
          type="text"
          className="flex-1 border border-gray-300 p-2 mr-2 rounded"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
        />
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={handleSendMessage}
        >
          Send
        </button>
      </div>
    </div>
  );
};

Chat.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      text: PropTypes.string,
      sender: PropTypes.string,
    })
  ),
  inputText: PropTypes.string.isRequired,
  setInputText: PropTypes.func.isRequired,
  handleSendMessage: PropTypes.func.isRequired,
};

Chat.defaultProps = {
  messages: [],
};

export default Chat;