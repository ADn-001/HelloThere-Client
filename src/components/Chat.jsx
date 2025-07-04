import React from 'react';
import PropTypes from 'prop-types';

// Group chat UI component
const Chat = ({ messages, inputText, setInputText, handleSendMessage, peerId }) => {
  console.log('[Chat] Rendering with messages:', messages);

  const safeMessages = Array.isArray(messages) ? messages : [];

  return (
    <div className="chat-container">
      <style>
        {`
          .chat-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .chat-messages {
            max-height: 60vh;
            overflow-y: auto;
            padding: 8px;
          }

          .message {
            max-width: 70%;
            padding: 8px 12px;
            margin: 4px 8px;
            border-radius: 12px;
            font-size: 16px;
            color: #FFFFFF;
          }

          .message-self {
            background-color: #10B981;
            margin-left: auto;
            text-align: right;
          }

          .message-other {
            background-color: #343541;
            margin-right: auto;
            text-align: left;
          }

          .message-sender {
            font-weight: 600;
            margin-right: 8px;
          }

          .chat-input-container {
            display: flex;
            gap: 8px;
          }

          .chat-input {
            flex: 1;
            background-color: #343541;
            color: #FFFFFF;
            border: 1px solid #4B5563;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 16px;
            outline: none;
          }

          .chat-input::placeholder {
            color: #6B7280;
          }

          .send-button {
            background-color: #10B981;
            color: #FFFFFF;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .send-button:hover {
            background-color: #059669;
          }
        `}
      </style>
      <div className="chat-messages">
        {safeMessages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.sender === peerId ? 'message-self' : 'message-other'}`}
          >
            <span className="message-sender">
              {msg.sender === peerId ? 'You' : msg.sender}:
            </span>
            {msg.text}
          </div>
        ))}
      </div>
      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
        />
        <button
          className="send-button"
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
  peerId: PropTypes.string.isRequired,
};

Chat.defaultProps = {
  messages: [],
};

export default Chat;