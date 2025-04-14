<script setup lang="ts">

const props = defineProps({
  // 是否显示对话框
  visible: {
    type: Boolean,
    default: false
  },
  // 对话框标题
  title: {
    type: String,
    default: '提示'
  },
  // 对话框内容
  content: {
    type: String,
    default: ''
  },
  // 确认按钮文本
  confirmText: {
    type: String,
    default: '确定'
  },
  // 取消按钮文本
  cancelText: {
    type: String,
    default: '取消'
  },
  // 是否显示取消按钮
  showCancel: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['confirm', 'cancel', 'update:visible']);

// 确认操作
const handleConfirm = () => {
  emit('confirm');
  closeDialog();
};

// 取消操作
const handleCancel = () => {
  emit('cancel');
  closeDialog();
};

// 关闭对话框
const closeDialog = () => {
  emit('update:visible', false);
};
</script>

<template>
  <Teleport to="body">
    <div class="dialog-overlay" v-if="visible" @click="handleCancel">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ title }}</h3>
        </div>
        <div class="dialog-content">
          <!-- 如果有插槽内容则使用插槽，否则显示文本内容 -->
          <slot name="content">
            <p>{{ content }}</p>
          </slot>
        </div>
        <div class="dialog-footer">
          <button v-if="showCancel" class="btn btn-cancel" @click="handleCancel">{{ cancelText }}</button>
          <button class="btn btn-confirm" @click="handleConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  background-color: #fff;
  border-radius: 4px;
  min-width: 300px;
  max-width: 500px;
  overflow: hidden;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16);
}

.dialog-header {
  padding: 15px 20px;
  border-bottom: 1px solid #e0e0e0;
  
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: normal;
  }
}

.dialog-content {
  padding: 20px;
  
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }
}

.dialog-footer {
  padding: 10px 20px 15px;
  text-align: right;
  
  .btn {
    padding: 8px 16px;
    margin-left: 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
    
    &.btn-cancel {
      background-color: #f0f0f0;
      
      &:hover {
        background-color: #e0e0e0;
      }
    }
    
    &.btn-confirm {
      background-color: #4a4a4a;
      color: white;
      
      &:hover {
        background-color: #333;
      }
    }
  }
}
</style> 